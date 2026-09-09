export interface SeriesPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: SeriesPoint[];
  color: string;
  height?: number;
  suffix?: string;
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const cx = (prev.x + cur.x) / 2;
    d += ` C ${cx} ${prev.y}, ${cx} ${cur.y}, ${cur.x} ${cur.y}`;
  }
  return d;
}

export default function AreaChart({ data, color, height = 150 }: AreaChartProps) {
  const width = 640;
  const pad = 8;
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.15;
  const innerH = height - pad * 2;
  const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;

  const pts = data.map((d, i) => ({
    x: pad + i * stepX,
    y: pad + innerH - (d.value / max) * innerH,
  }));
  const line = smoothPath(pts);
  const area =
    line && pts.length > 1
      ? `${line} L ${pts[pts.length - 1].x} ${height - pad} L ${pts[0].x} ${height - pad} Z`
      : '';

  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-36 w-full animate-[dash_.8s_ease-out]"
        role="img"
        aria-label="Gráfico de tendencia"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${gradId})`} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ transition: 'all .4s ease' }}
          />
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="#ffffff" stroke={color} strokeWidth={1.8} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        {data.map((d, i) => (
          <span key={i} className="truncate px-0.5" title={`${d.label}: ${d.value.toLocaleString('es-PY')}`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
