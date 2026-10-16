export function StatGrid({
  items,
}: {
  items: { label: string; value: string | number; hint?: string; kind?: string }[];
}) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <div key={item.label} className="stat">
          <div className="stat-label">{item.label}</div>
          <div className="stat-value">{item.value}</div>
          {item.hint ? <div className="muted">{item.hint}</div> : null}
          {item.kind ? <div className="badge">{item.kind}</div> : null}
        </div>
      ))}
    </div>
  );
}
