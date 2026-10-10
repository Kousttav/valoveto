import 'dotenv/config'; // loads .env into process.env
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gen, settle, mapUsed, MODES, MIN_POOL } from './veto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
// Comma-separated list of accepted admin passwords, e.g. ADMIN_PASSWORDS="one,two,three"
const ADMIN_PASSWORDS = (process.env.ADMIN_PASSWORDS || process.env.ADMIN_PASSWORD || 'admin123')
  .split(',').map((p) => p.trim()).filter(Boolean);
const SECRET = process.env.SECRET || crypto.randomBytes(32).toString('hex');
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!process.env.ADMIN_PASSWORDS && !process.env.ADMIN_PASSWORD) console.warn('⚠  Using default admin password "admin123". Set ADMIN_PASSWORDS in production.');

/* ---------------- Cloudinary ---------------- */
const { CLOUDINARY_CLOUD_NAME: CN, CLOUDINARY_API_KEY: CK, CLOUDINARY_API_SECRET: CS } = process.env;
const CLOUD = !!(CN && CK && CS);
const FOLDER = process.env.CLOUDINARY_FOLDER || 'valorant-veto';
if (CLOUD) cloudinary.config({ cloud_name: CN, api_key: CK, api_secret: CS, secure: true });
else console.warn('⚠  Cloudinary env vars missing: image upload disabled and data is stored in a local file.');
// The database snapshot is stored as a raw file; its name is derived from the API secret so it is not guessable.
const DB_ID = `${FOLDER}/db-${crypto.createHash('sha256').update(String(CS)).digest('hex').slice(0, 24)}.json`;

const streamUp = (buf, opts) => new Promise((resolve, reject) =>
  cloudinary.uploader.upload_stream(opts, (e, r) => (e ? reject(e) : resolve(r))).end(buf));
const uploadImage = (buf) => streamUp(buf, {
  folder: `${FOLDER}/maps`, resource_type: 'image',
  transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
});
const rmImage = (id) => { if (CLOUD && id) cloudinary.uploader.destroy(id).catch(() => {}); };

/* ---------------- database (Cloudinary raw file, or local file for dev) ---------------- */
const DB_FILE = path.join(DATA_DIR, 'db.json');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ACTIVE = ['Abyss', 'Ascent', 'Bind', 'Corrode', 'Haven', 'Pearl', 'Split'];
const ALL = ['Abyss', 'Ascent', 'Bind', 'Breeze', 'Corrode', 'Fracture', 'Haven', 'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset'];
let db = { maps: ALL.map((n) => ({ id: slug(n), name: n, image: null, imageId: null, active: ACTIVE.includes(n) })), matches: {} };

async function loadDb() {
  try {
    if (CLOUD) {
      const r = await cloudinary.api.resource(DB_ID, { resource_type: 'raw' }); // throws on first run
      const res = await fetch(r.secure_url);
      if (res.ok) { db = await res.json(); console.log('Database loaded from Cloudinary'); }
    } else if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) { console.log('Starting with a fresh database'); }
}
await loadDb();

let saveTimer; let saving = false; let dirty = false;
async function flush() {
  if (saving) { saveTimer = setTimeout(flush, 1000); return; }
  if (!dirty) return;
  dirty = false; saving = true;
  try {
    const json = JSON.stringify(db);
    if (CLOUD) await streamUp(Buffer.from(json), { resource_type: 'raw', public_id: DB_ID, overwrite: true, invalidate: true });
    else { fs.writeFileSync(DB_FILE + '.tmp', json); fs.renameSync(DB_FILE + '.tmp', DB_FILE); }
  } catch (e) { console.error('Save failed:', e.message); dirty = true; }
  finally { saving = false; }
}
const save = () => { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, CLOUD ? 2500 : 100); };
// Render sends SIGTERM on redeploy/restart: write the last changes first
process.on('SIGTERM', async () => { clearTimeout(saveTimer); await flush(); process.exit(0); });

/* ---------------- helpers ---------------- */
const rid = (n) => crypto.randomBytes(n).toString('base64url').replace(/[-_]/g, 'x').slice(0, n);
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
const adminToken = () => { const exp = Date.now() + 12 * 3600e3; return `${exp}.${sign(String(exp))}`; };
const adminOk = (t = '') => {
  const [exp, sig] = t.split('.');
  return exp && sig && Date.now() < Number(exp) && crypto.timingSafeEqual(Buffer.from(sig.padEnd(64, '0')), Buffer.from(sign(exp)));
};
const requireAdmin = (req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  try { if (adminOk(t)) return next(); } catch { /* fallthrough */ }
  res.status(401).json({ error: 'Admin login required' });
};
const roleOf = (m, token) => (token && token === m.tokens.A ? 'A' : token && token === m.tokens.B ? 'B' : null);
const publicView = (m) => ({
  id: m.id, teamA: m.teamA, teamB: m.teamB, mode: m.mode, modeLabel: MODES[m.mode],
  pool: m.pool, phase: m.phase, toss: m.toss, first: m.first, steps: m.steps, idx: m.idx,
});
const fail = (res, msg, code = 400) => res.status(code).json({ error: msg });

/* ---------------- SSE (live updates) ---------------- */
const streams = new Map(); // matchId -> Set<res>
const broadcast = (m) => {
  const payload = `data: ${JSON.stringify(publicView(m))}\n\n`;
  (streams.get(m.id) || new Set()).forEach((r) => r.write(payload));
};
setInterval(() => streams.forEach((set) => set.forEach((r) => r.write(': ping\n\n'))), 25000);

/* ---------------- app ---------------- */
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => cb(/^image\//.test(f.mimetype) ? null : new Error('Only image files are allowed'), /^image\//.test(f.mimetype)),
});

/* --- health check (UptimeRobot / Render keep-alive) --- */
const health = (_req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
app.get(['/health', '/api/health'], health); // HEAD works automatically

/* --- fair coin (standalone page) --- */
app.get('/api/toss', (_req, res) => res.json({ result: crypto.randomInt(2) ? 'T' : 'H' }));

/* --- admin --- */
app.post('/api/admin/login', (req, res) => {
  const hash = (v) => crypto.createHash('sha256').update(String(v)).digest();
  const given = hash(req.body.password || '');
  // compare against every allowed password (constant-time, no early exit)
  let ok = false;
  for (const p of ADMIN_PASSWORDS) ok = crypto.timingSafeEqual(given, hash(p)) || ok;
  if (ok) return res.json({ token: adminToken() });
  fail(res, 'Wrong password', 401);
});

/* --- maps --- */
app.get('/api/maps', (_req, res) => res.json(db.maps));

app.post('/api/maps', requireAdmin, upload.single('image'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return fail(res, 'Map name required');
  const id = slug(name) || rid(6);
  if (db.maps.some((m) => m.id === id)) return fail(res, 'Map already exists');
  const map = { id, name, image: null, imageId: null, active: true };
  if (req.file) {
    if (!CLOUD) return fail(res, 'Cloudinary is not configured on the server', 503);
    try { const r = await uploadImage(req.file.buffer); map.image = r.secure_url; map.imageId = r.public_id; }
    catch (e) { return fail(res, 'Image upload failed: ' + e.message, 502); }
  }
  db.maps.push(map); save(); res.json(map);
});

app.put('/api/maps/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const map = db.maps.find((m) => m.id === req.params.id);
  if (!map) return fail(res, 'Not found', 404);
  if (req.body.name?.trim()) map.name = req.body.name.trim();
  if (req.body.active !== undefined) map.active = req.body.active === 'true' || req.body.active === true;
  if (req.file) {
    if (!CLOUD) return fail(res, 'Cloudinary is not configured on the server', 503);
    try {
      const r = await uploadImage(req.file.buffer);
      rmImage(map.imageId); map.image = r.secure_url; map.imageId = r.public_id;
    } catch (e) { return fail(res, 'Image upload failed: ' + e.message, 502); }
  }
  save(); res.json(map);
});

app.delete('/api/maps/:id', requireAdmin, (req, res) => {
  const i = db.maps.findIndex((m) => m.id === req.params.id);
  if (i < 0) return fail(res, 'Not found', 404);
  rmImage(db.maps[i].imageId); db.maps.splice(i, 1); save(); res.json({ ok: true });
});

/* --- matches --- */
app.post('/api/matches', (req, res) => {
  const { teamA, teamB, mode, maps } = req.body;
  if (!teamA?.trim() || !teamB?.trim()) return fail(res, 'Both team names are required');
  if (teamA.trim().toLowerCase() === teamB.trim().toLowerCase()) return fail(res, 'Team names must differ');
  if (!MODES[mode]) return fail(res, 'Invalid mode');
  const pool = (maps || []).map((id) => db.maps.find((m) => m.id === id)).filter(Boolean)
    .map(({ id, name, image }) => ({ id, name, image }));
  if (pool.length < MIN_POOL[mode]) return fail(res, `${MODES[mode]} needs at least ${MIN_POOL[mode]} maps`);
  const m = {
    id: rid(7), teamA: teamA.trim().slice(0, 30), teamB: teamB.trim().slice(0, 30), mode, pool,
    tokens: { A: rid(14), B: rid(14) }, phase: 'toss', toss: null, first: null, steps: [], idx: 0, created: Date.now(),
  };
  db.matches[m.id] = m; save();
  res.json({ id: m.id, tokens: m.tokens });
});

const getMatch = (req, res) => {
  const m = db.matches[req.params.id];
  if (!m) { fail(res, 'Match not found', 404); return null; }
  return m;
};

app.get('/api/matches/:id', (req, res) => {
  const m = getMatch(req, res); if (!m) return;
  res.json({ match: publicView(m), you: roleOf(m, req.query.token) });
});

app.get('/api/matches/:id/stream', (req, res) => {
  const m = getMatch(req, res); if (!m) return;
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(publicView(m))}\n\n`);
  if (!streams.has(m.id)) streams.set(m.id, new Set());
  streams.get(m.id).add(res);
  req.on('close', () => streams.get(m.id)?.delete(res));
});

app.post('/api/matches/:id/toss', (req, res) => {
  const m = getMatch(req, res); if (!m) return;
  if (roleOf(m, req.body.token) !== 'A') return fail(res, 'Only Team A captain calls the toss', 403);
  if (m.phase !== 'toss' || m.toss) return fail(res, 'Toss already done');
  const call = req.body.call === 'T' ? 'T' : 'H';
  const result = crypto.randomInt(2) ? 'T' : 'H';
  m.toss = { call, res: result, winner: call === result ? 'A' : 'B' };
  m.phase = 'choice'; save(); broadcast(m); res.json({ ok: true });
});

app.post('/api/matches/:id/choice', (req, res) => {
  const m = getMatch(req, res); if (!m) return;
  const role = roleOf(m, req.body.token);
  if (m.phase !== 'choice' || role !== m.toss.winner) return fail(res, 'Not allowed', 403);
  const choice = req.body.choice === 'side' ? 'side' : 'map';
  const loser = m.toss.winner === 'A' ? 'B' : 'A';
  m.toss.choice = choice;
  m.first = choice === 'map' ? m.toss.winner : loser;
  m.steps = gen(m.mode, m.pool.length, m.first);
  m.idx = 0; m.phase = 'veto'; settle(m); save(); broadcast(m); res.json({ ok: true });
});

app.post('/api/matches/:id/action', (req, res) => {
  const m = getMatch(req, res); if (!m) return;
  const role = roleOf(m, req.body.token);
  const cur = m.steps[m.idx];
  if (m.phase !== 'veto' || !cur || cur.team !== role) return fail(res, "It's not your turn", 403);
  const { value } = req.body;
  if (cur.t === 'side') {
    if (!['Attack', 'Defense'].includes(value)) return fail(res, 'Choose Attack or Defense');
    cur.side = value;
  } else {
    if (!m.pool.some((p) => p.id === value) || mapUsed(m, value)) return fail(res, 'Map not available');
    cur.map = value;
    if (cur.t === 'pick') m.steps[m.idx + 1].map = value;
  }
  m.idx++; settle(m); save(); broadcast(m); res.json({ ok: true });
});

/* --- serve the built React app in production --- */
const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api).*/, (_r, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.use((err, _req, res, _next) => fail(res, err.message || 'Server error', 400));
app.listen(PORT, () => console.log(`Valorant veto server on http://localhost:${PORT}`));