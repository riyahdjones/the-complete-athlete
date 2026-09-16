export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <header className="section-header">
      <div><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action && <em>{action}</em>}
    </header>
  );
}

export function Sparkline({ values = [], tone = 'blue' }) {
  if (!values.length) return <div className="sparkline unavailable" aria-label="Trend unavailable" />;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${32 - (value / max) * 28}`).join(' ');
  return (
    <svg className={`sparkline ${tone}`} viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label="Metric trend">
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MetricCard({ label, value, detail, trend, values, tone = 'blue' }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-topline"><span>{label}</span><i /></div>
      <strong>{value ?? '—'}</strong>
      <div className="metric-context">
        {trend != null ? <b className={Number(trend) >= 0 ? 'positive' : 'negative'}>{Number(trend) >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</b> : <b className="neutral">Live</b>}
        <em>{detail}</em>
      </div>
      <Sparkline values={values} tone={tone} />
    </article>
  );
}

export function AnalyticsChart({ data = [] }) {
  if (!data.length) return <div className="chart-empty">Growth history unavailable</div>;
  const width = 720;
  const height = 250;
  const pad = 20;
  const max = Math.max(...data.map((point) => point.total), 1);
  const line = (key) => data.map((point, index) => {
    const x = pad + (index / Math.max(data.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - (point[key] / max) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const area = `${pad},${height - pad} ${line('total')} ${width - pad},${height - pad}`;
  return (
    <div className="growth-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="User growth over the last 30 days">
        <defs><linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#238cff" stopOpacity=".3" /><stop offset="100%" stopColor="#238cff" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map((lineIndex) => <line key={lineIndex} x1={pad} x2={width - pad} y1={pad + lineIndex * 52.5} y2={pad + lineIndex * 52.5} />)}
        <polygon className="chart-area" points={area} />
        <polyline className="chart-line total" points={line('total')} />
        <polyline className="chart-line athletes" points={line('athletes')} />
        <polyline className="chart-line parents" points={line('parents')} />
        {data.filter((_, index) => index % 7 === 0 || index === data.length - 1).map((point, index) => {
          const originalIndex = data.indexOf(point);
          const x = pad + (originalIndex / Math.max(data.length - 1, 1)) * (width - pad * 2);
          return <text key={`${point.date}-${index}`} x={x} y={height - 2} textAnchor={originalIndex === 0 ? 'start' : originalIndex === data.length - 1 ? 'end' : 'middle'}>{point.label}</text>;
        })}
      </svg>
      <div className="chart-legend command-legend"><span><i className="total" /> Total users</span><span><i className="athletes" /> Athletes</span><span><i className="parents" /> Parents</span></div>
    </div>
  );
}

export function Funnel({ stages = [] }) {
  const max = Math.max(...stages.map((stage) => stage.value), 1);
  return <div className="funnel">{stages.map((stage, index) => {
    const previous = stages[index - 1]?.value;
    const rawConversion = index && previous ? Math.round((stage.value / previous) * 100) : null;
    const conversion = rawConversion != null && rawConversion <= 100 ? `${rawConversion}%` : rawConversion != null ? 'tracking gap' : null;
    return <div className="funnel-stage" key={stage.label}>
      {conversion != null && <span className="funnel-conversion">{conversion}</span>}
      <div style={{ '--funnel-width': `${Math.max(42, (stage.value / max) * 100)}%` }}><span>{stage.label}</span><strong>{stage.value}</strong></div>
    </div>;
  })}</div>;
}

export function ActivityHeatmap({ cells = [] }) {
  const max = Math.max(...cells.flat(), 1);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-hours"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span></div>
      <div className="heatmap">
        {cells.map((hours, day) => <div className="heatmap-row" key={labels[day]}><span>{labels[day]}</span>{hours.map((count, hour) => <i key={hour} title={`${labels[day]} ${hour}:00 — ${count} events`} style={{ '--heat': max ? count / max : 0 }} />)}</div>)}
      </div>
    </div>
  );
}

export function FeatureAdoption({ features = [] }) {
  return <div className="adoption-list">{features.map((feature) => <div className="adoption-row" key={feature.label}>
    <div><strong>{feature.label}</strong><span>{feature.detail}</span></div>
    <div className={feature.value == null ? 'adoption-track unavailable' : 'adoption-track'}><i style={{ '--adoption': `${feature.value ?? 0}%` }} /></div>
    <em>{feature.value == null ? 'N/A' : `${feature.value}%`}</em>
  </div>)}</div>;
}

export function StatusIndicator({ label, status, detail }) {
  return <div className={`health-row status-${status}`}><span><i />{label}</span><strong>{status}</strong><em>{detail}</em></div>;
}

export function ActivityFeed({ items = [] }) {
  return <div className="live-feed">{items.length ? items.map((item) => <div key={item.id}>
    <time>{item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time>
    <i />
    <span><strong>{item.label}</strong><em>{item.detail}</em></span>
  </div>) : <p className="empty-state">No recent activity is available.</p>}</div>;
}
