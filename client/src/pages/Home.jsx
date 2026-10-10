import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import MapCard from '../components/MapCard.jsx';

const MODES = [
  ['bo1', 'Best of 1'], ['bo2', 'Best of 2'], ['bo3', 'Best of 3'],
  ['s1', 'Single match'], ['s2', 'Double match'], ['s3', 'Triple match'],
];
const MIN = { bo1: 3, bo2: 5, bo3: 5, s1: 2, s2: 3, s3: 4 };

export default function Home() {
  const nav = useNavigate();
  const [maps, setMaps] = useState([]);
  const [sel, setSel] = useState([]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [mode, setMode] = useState('bo3');
  const [err, setErr] = useState('');
  const [created, setCreated] = useState(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.maps().then((m) => { setMaps(m); setSel(m.filter((x) => x.active).map((x) => x.id)); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function create() {
    setErr('');
    if (!a.trim() || !b.trim()) return setErr('Enter both team names.');
    if (sel.length < MIN[mode]) return setErr(`This mode needs at least ${MIN[mode]} maps in the pool.`);
    try {
      const res = await api.createMatch({ teamA: a, teamB: b, mode, maps: sel });
      setCreated({ ...res, a, b });
    } catch (e) { setErr(e.message); }
  }

  function join() {
    const parts = code.trim().split('/').filter(Boolean);
    const i = parts.indexOf('m');
    const [id, token] = i >= 0 ? parts.slice(i + 1) : code.trim().split('~');
    if (!id) return setErr('Paste a match link or join code.');
    nav(`/m/${id}${token ? `/${token}` : ''}`);
  }

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); };
  const url = (t) => `${location.origin}/m/${created.id}${t ? `/${t}` : ''}`;

  return (
    <>
      <div className="hero">
        <h1 data-t="Map Veto Arena">Map Veto Arena</h1>
        <p className="muted">Toss. Ban. Pick. Lock in your battleground.</p>
        {loading && <p className="muted">Connecting to the server… (free hosting can take ~30s to wake up)</p>}
      </div>

      <div className="card">
        <h2>Join a match</h2>
        <div className="link">
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste captain link or code" />
          <button onClick={join}>Join</button>
        </div>
      </div>

      <div className="card">
        <h2>New match</h2>
        <div className="row">
          <div><label className="l">Team 1 name</label><input type="text" value={a} onChange={(e) => setA(e.target.value)} placeholder="Team A" maxLength={30} /></div>
          <div><label className="l">Team 2 name</label><input type="text" value={b} onChange={(e) => setB(e.target.value)} placeholder="Team B" maxLength={30} /></div>
        </div>
        <label className="l">Mode</label>
        <div className="chips">
          {MODES.map(([k, v]) => (
            <label key={k}><input type="radio" name="mode" checked={mode === k} onChange={() => setMode(k)} /><span>{v}</span></label>
          ))}
        </div>
        <label className="l">Map pool ({sel.length} selected)</label>
        <div className="mgrid">
          {maps.map((m, i) => (
            <label key={m.id} className="pcw">
              <input type="checkbox" checked={sel.includes(m.id)} onChange={() => toggle(m.id)} />
              <MapCard map={m} index={i} small />
            </label>
          ))}
        </div>
        {err && <p className="err">{err}</p>}
        <p><button onClick={create}>Create match</button></p>
      </div>

      {created && (
        <div className="card">
          <h2>Match ready</h2>
          <p className="muted">Send each captain their own link. Keep them private: each one controls that team.</p>
          {[[`Captain – ${created.a}`, created.tokens.A], [`Captain – ${created.b}`, created.tokens.B], ['Spectator (view only)', '']].map(([label, t]) => (
            <div key={label}>
              <label className="l">{label}</label>
              <div className="link">
                <input type="text" readOnly value={url(t)} onFocus={(e) => e.target.select()} />
                <button className="g" onClick={() => copy(url(t), label)}>{copied === label ? 'Copied' : 'Copy'}</button>
              </div>
            </div>
          ))}
          <p><button onClick={() => nav(`/m/${created.id}`)}>Open spectator view</button></p>
        </div>
      )}
    </>
  );
}
