import { useEffect, useMemo } from 'react';

/** Splash intro, light beams, floating diamonds and click bursts. */
export default function FX() {
  const particles = useMemo(
    () => Array.from({ length: 16 }, () => {
      const z = 8 + Math.random() * 18;
      return {
        left: `${Math.random() * 100}%`, width: z, height: z,
        animationDuration: `${9 + Math.random() * 14}s`,
        animationDelay: `-${Math.random() * 20}s`,
        opacity: 0.3 + Math.random() * 0.6,
      };
    }), []);

  useEffect(() => {
    const onDown = (e) => {
      const b = document.createElement('div');
      b.className = 'burst';
      b.style.left = `${e.clientX}px`;
      b.style.top = `${e.clientY}px`;
      let html = '<b></b>';
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4, d = 34 + Math.random() * 26;
        html += `<i style="--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px"></i>`;
      }
      b.innerHTML = html;
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 700);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  return (
    <>
      <div id="splash"><div className="sl" /><div className="st">VALO<em>VETO</em></div></div>
      <div className="beam" />
      <div className="beam b2" style={{ left: '60%' }} />
      {particles.map((p, i) => <div key={i} className="pt" style={p} />)}
    </>
  );
}
