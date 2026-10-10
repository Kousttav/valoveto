import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import Coin from '../components/Coin.jsx';
import Flash from '../components/Flash.jsx';
import MapCard from '../components/MapCard.jsx';

export default function Match() {
  const { id, token } = useParams();
  const [m, setM] = useState(null);
  const [you, setYou] = useState(null);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState(null);
  const lastIdx = useRef(null);

  // initial load (also tells us which captain we are) + live stream
  useEffect(() => {
    let es;
    api.getMatch(id, token)
      .then(({ match, you }) => {
        setM(match); setYou(you);
        es = new EventSource(`/api/matches/${id}/stream`);
        es.onmessage = (e) => setM(JSON.parse(e.data));
      })
      .catch((e) => setErr(e.message));
    return () => es && es.close();
  }, [id, token]);

  // dramatic flash whenever a ban / pick / side lands
  useEffect(() => {
    if (!m) return;
    const prev = lastIdx.current;
    lastIdx.current = m.idx;
    if (prev === null || m.idx <= prev) return;
    const s = m.steps[m.idx - 1];
    const team = name(m, s.team);
    const mapName = m.pool.find((p) => p.id === s.map)?.name || '';
    if (s.t === 'ban') setFlash({ title: 'Banned', sub: `${mapName} · ${team}`, color: '#ff4655' });
    else if (s.t === 'pick') setFlash({ title: 'Locked in', sub: `${mapName} · ${team}`, color: '#1fae72' });
    else setFlash({ title: s.side, sub: `${mapName} · ${team}`, color: '#3a6df0' });
  }, [m?.idx]); // eslint-disable-line

  if (err) return <div className="card err">{err}</div>;
  if (!m) return <p className="muted">Loading match…</p>;

  const act = (fn) => fn().catch((e) => setErr(e.message));
  const cur = m.steps[m.idx];
  const my = !!you && cur?.team === you;
  const mapOf = (mid) => m.pool.find((p) => p.id === mid);

  // status of each map on the board
  const st = {};
  m.steps.forEach((s, i) => {
    if (s.map && (s.t !== 'side' || s.dec)) st[s.map] = { k: s.dec ? 'decider' : s.t, team: s.team };
  });
  const played = m.steps
    .map((s, i) => ({ s, n: m.steps[i + 1] }))
    .filter(({ s }) => s.t === 'pick' || s.dec);

  return (
    <>
      <Flash event={flash} />
      <div className="vs"><span>{m.teamA}</span><i>VS</i><span>{m.teamB}</span></div>
      <p className="muted" style={{ textAlign: 'center' }}>
        {m.modeLabel} · {you ? `You are captain of ${name(m, you)}` : 'Spectator'}
      </p>

      {(m.phase === 'toss' || m.phase === 'choice') && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>Coin toss</h2>
          <Coin result={m.toss?.res} flipKey={m.toss?.res || 'none'} />
          {!m.toss ? (
            you === 'A' ? (
              <>
                <p>{m.teamA}, call it:</p>
                <button onClick={() => act(() => api.callToss(id, token, 'H'))}>Heads</button>{' '}
                <button onClick={() => act(() => api.callToss(id, token, 'T'))}>Tails</button>
              </>
            ) : <p className="muted">Waiting for {m.teamA} to call the toss…</p>
          ) : (
            <>
              <h2 className="ok">{m.toss.res === 'H' ? 'HEADS' : 'TAILS'} · {name(m, m.toss.winner)} won the toss</h2>
              <p className="muted">{m.teamA} called {m.toss.call === 'H' ? 'heads' : 'tails'}</p>
              {m.phase === 'choice' && (you === m.toss.winner ? (
                <>
                  <p>Choose your advantage:</p>
                  <button onClick={() => act(() => api.choose(id, token, 'map'))}>Pick map first</button>{' '}
                  <button onClick={() => act(() => api.choose(id, token, 'side'))}>Choose side</button>
                  <p className="muted">Map first: you start the veto and your opponent picks the side. Side: your opponent starts the veto and you pick the side on the first map.</p>
                </>
              ) : <p className="muted">Waiting for {name(m, m.toss.winner)} to choose…</p>)}
            </>
          )}
        </div>
      )}

      {(m.phase === 'veto' || m.phase === 'done') && (
        <>
          {cur ? (
            <div className={`banner ${my ? 'me' : ''}`}>
              {my && 'Your turn · '}
              {cur.t === 'side' ? `${name(m, cur.team)} chooses a side on ${mapOf(cur.map)?.name}` : `${name(m, cur.team)} to ${cur.t.toUpperCase()}`}
            </div>
          ) : <div className="banner ok">Veto complete</div>}

          {cur?.t === 'side' && my && (
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <button onClick={() => act(() => api.act(id, token, 'Attack'))}>Attack</button>{' '}
              <button onClick={() => act(() => api.act(id, token, 'Defense'))}>Defense</button>
            </div>
          )}

          <div className="maps">
            {m.pool.map((p, i) => {
              const s = st[p.id];
              const can = my && !s && cur && cur.t !== 'side';
              return (
                <MapCard key={p.id} map={p} index={i}
                  className={`${s ? s.k : ''} ${can ? 'can' : ''}`}
                  tag={s ? (s.k === 'decider' ? 'DECIDER' : s.k.toUpperCase()) : ''}
                  sub={s ? name(m, s.team) : ''}
                  onClick={can ? () => act(() => api.act(id, token, p.id)) : undefined} />
              );
            })}
          </div>

          {played.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2>Match maps</h2>
              <ol className="res">
                {played.map(({ s, n }) => {
                  const sd = s.dec ? s : n;
                  return (
                    <li key={s.map + s.t}>
                      <b>{mapOf(s.map)?.name}</b> {s.dec ? '(decider)' : `— picked by ${name(m, s.team)}`}<br />
                      <span className="muted">
                        {sd?.side
                          ? `${name(m, sd.team)} chose ${sd.side} → ${name(m, sd.team === 'A' ? 'B' : 'A')} starts ${sd.side === 'Attack' ? 'Defense' : 'Attack'}`
                          : 'side pending'}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}
      <p style={{ textAlign: 'center' }}><Link to="/" className="muted">← Home</Link></p>
    </>
  );
}

function name(m, t) { return t === 'A' ? m.teamA : m.teamB; }
