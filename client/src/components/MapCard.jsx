const hue = (name) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);

/** Poster-style map card. Falls back to a generated gradient when no image. */
export default function MapCard({ map, index = 0, className = '', tag, sub, onClick, small, children }) {
  const style = { '--h': hue(map.name), '--i': index };
  if (map.image) style['--img'] = `url('${map.image}')`;
  return (
    <div className={`map ${className}`} style={style} onClick={onClick}>
      <div className="im" />
      {tag && <span className="tag">{tag}</span>}
      <b style={small ? { fontSize: 15 } : undefined}>{map.name}</b>
      {sub !== undefined && <small>{sub}</small>}
      {children}
    </div>
  );
}
