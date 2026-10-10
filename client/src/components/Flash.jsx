import { useEffect, useState } from 'react';

/** Full-screen "BANNED / LOCKED IN" slash. Pass a new `event` object to trigger. */
export default function Flash({ event }) {
  const [cur, setCur] = useState(null);
  useEffect(() => {
    if (!event) return;
    setCur(event);
    const t = setTimeout(() => setCur(null), 1600);
    return () => clearTimeout(t);
  }, [event]);
  if (!cur) return null;
  return (
    <div className="flash" style={{ '--c': cur.color }}>
      <div className="fb" />
      <div className="ft">{cur.title}<small>{cur.sub}</small></div>
    </div>
  );
}
