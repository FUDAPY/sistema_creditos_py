import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface PortfolioRow {
  id: string;
  clientName: string;
  collectorName: string;
  loanType: string;
  principal: number;
  currentBalance: number;
  paidAmount: number;
  status: string;
  color: string;
  label: string;
}

export default function Portfolio() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<PortfolioRow[]>('/reports/portfolio').then(setRows).catch((e) => setError(e.message));
  }, [user?.companyId]);

  const badgeColor: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    red: 'bg-red-100 text-red-800',
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <h2 className="mb-4 text-xl font-semibold">Cartera</h2>
      {error && <p className="mb-3 text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Cobrador</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2 text-right">Capital</th>
              <th className="px-4 py-2 text-right">Saldo</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-2">{row.clientName || '-'}</td>
                <td className="px-4 py-2">{row.collectorName || '-'}</td>
                <td className="px-4 py-2">{row.loanType}</td>
                <td className="px-4 py-2 text-right">{row.principal.toLocaleString('es-PY')}</td>
                <td className="px-4 py-2 text-right">{row.currentBalance.toLocaleString('es-PY')}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeColor[row.color] || ''}`}>
                    {row.status} · {row.label}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Sin créditos activos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
