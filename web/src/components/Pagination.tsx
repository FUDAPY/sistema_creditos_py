interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

/** Navegación numérica inferior (25 registros por página). */
export default function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const nums: Array<number | '…'> = [];
  for (let i = 1; i <= pages; i += 1) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 2) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">
        Mostrando {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-600 disabled:opacity-40"
        >
          ‹
        </button>
        {nums.map((n, i) =>
          typeof n === 'number' ? (
            <button
              key={`${n}-${i}`}
              onClick={() => onChange(n)}
              className={`h-8 min-w-8 rounded-lg px-2 text-sm ${
                n === page ? 'bg-teal-600 font-semibold text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {n}
            </button>
          ) : (
            <span key={`e-${i}`} className="px-1 text-xs text-slate-400">
              …
            </span>
          ),
        )}
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-600 disabled:opacity-40"
        >
          ›
        </button>
      </div>
    </div>
  );
}
