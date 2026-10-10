import { useEffect, useRef } from 'react';

/** 3D coin. Spins whenever `flipKey` changes after mount; first render is static. */
export default function Coin({ result, flipKey }) {
  const ref = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    const c = ref.current;
    const end = result === 'T' ? 180 : 0;
    if (!mounted.current) {
      mounted.current = true;
      c.style.transform = `rotateY(${end}deg)`;
      return;
    }
    c.style.transition = 'none';
    c.style.transform = 'rotateY(0deg)';
    void c.offsetWidth; // restart the transition
    c.style.transition = 'transform 2.2s cubic-bezier(.2,.7,.2,1)';
    c.style.transform = `rotateY(${1800 + end}deg)`;
  }, [flipKey]); // eslint-disable-line

  return (
    <div className="coinwrap">
      <div className="coin" ref={ref}><div>H</div><div className="t">T</div></div>
    </div>
  );
}
