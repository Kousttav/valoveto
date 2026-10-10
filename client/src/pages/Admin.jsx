import { useEffect, useState } from 'react';
import { api } from '../api.js';
import MapCard from '../components/MapCard.jsx';

export default function Admin() {
  const [authed, setAuthed] = useState(api.isAdmin());
  const [pw, setPw] = useState('');
  const [maps, setMaps] = useState([]);
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);

  const load = () => api.maps().then(setMaps);
  useEffect(() => { if (authed) load().catch(() => {}); }, [authed]);

  const run = async (fn, ok) => {
    try { await fn(); await load(); setMsg(ok); }
    catch (e) {
      setMsg(e.message);
      if (/login/i.test(e.message)) { api.logout(); setAuthed(false); }
    }
  };

  async function login(e) {
    e.preventDefault();
    try { await api.login(pw); setAuthed(true); setMsg(''); } catch (er) { setMsg(er.message); }
  }

  if (!authed) {
    return (
      <>
        <h1 data-t="Admin">Admin</h1>
        <form className="card" onSubmit={login}>
          <label className="l">Admin password</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          {msg && <p className="err">{msg}</p>}
          <p><button>Enter</button></p>
        </form>
      </>
    );
  }

  const upd = (id, fields, file) => {
    const f = new FormData();
    Object.entries(fields).forEach(([k, v]) => f.append(k, v));
    if (file) f.append('image', file);
    return run(() => api.updateMap(id, f), 'Saved ✓');
  };

  function add(e) {
    e.preventDefault();
    const f = new FormData();
    f.append('name', name);
    if (file) f.append('image', file);
    run(async () => { await api.addMap(f); setName(''); setFile(null); e.target.reset(); }, 'Map added ✓');
  }

  return (
    <>
      <h1 data-t="Admin · Map Pool">Admin · Map Pool</h1>
      <div className="card">
        <p className="muted">Changes apply to new matches. Upload a splash image for each map.</p>
        <table>
          <tbody>
            {maps.map((m, i) => (
              <tr key={m.id}>
                <td style={{ width: 120 }}><MapCard map={m} index={i} small /></td>
                <td>
                  <input type="file" accept="image/*" style={{ fontSize: 12, maxWidth: 200 }}
                    onChange={(e) => e.target.files[0] && upd(m.id, {}, e.target.files[0])} />
                </td>
                <td><label><input type="checkbox" checked={m.active} onChange={(e) => upd(m.id, { active: e.target.checked })} /> Default pool</label></td>
                <td><button className="g" onClick={() => confirm(`Delete ${m.name}?`) && run(() => api.deleteMap(m.id), 'Deleted')}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ marginTop: 24 }}>Add new map</h2>
        <form onSubmit={add}>
          <div className="row">
            <input type="text" placeholder="Map name" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
          </div>
          <p><button disabled={!name.trim()}>Add map</button> <button type="button" className="g" onClick={() => { api.logout(); setAuthed(false); }}>Log out</button></p>
        </form>
        {msg && <p className="ok">{msg}</p>}
      </div>
    </>
  );
}
