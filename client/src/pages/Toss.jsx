import { useState } from 'react';
import { api } from '../api.js';
import Coin from '../components/Coin.jsx';

export default function Toss() {
  const [result, setResult] = useState('H');
  const [key, setKey] = useState(0);
  const [shown, setShown] = useState(null);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState({ H: 0, T: 0 });

  async function flip() {
    setBusy(true);
    try {
      const { result: r } = await api.toss(); // server-side crypto random: 50/50
      setResult(r); setKey((k) => k + 1); setShown(null);
      setTimeout(() => { setShown(r); setScore((s) => ({ ...s, [r]: s[r] + 1 })); setBusy(false); }, 2300);
    } catch { setBusy(false); }
  }

  return (
    <>
      <h1 data-t="Coin Toss">Coin Toss</h1>
      <div className="card" style={{ textAlign: 'center' }}>
        <p className="muted">Unbiased toss generated on the server with a cryptographic random number generator.</p>
        <Coin result={result} flipKey={key} />
        <h2>{shown ? (shown === 'H' ? 'HEADS' : 'TAILS') : busy ? '...' : 'Ready'}</h2>
        <button onClick={flip} disabled={busy}>Flip coin</button>
        <p className="muted">Heads {score.H} · Tails {score.T}</p>
      </div>
    </>
  );
}
