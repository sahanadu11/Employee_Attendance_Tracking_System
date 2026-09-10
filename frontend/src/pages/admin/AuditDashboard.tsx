import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiFileText, FiDownload } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, StatusBadge, Loading, ErrorState, EmptyState, exportCsv, formatDateTime } from '../../components/ui';

export default function AuditDashboard() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');

  const auditQ = useQuery({
    queryKey: ['dash-audit', page, action, search],
    queryFn: () => dashboardAPI.audit({ page, limit: 25, action: action || undefined, search: search || undefined }),
  });
  const data = auditQ.data?.data;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        {(data?.actionCounts || []).slice(0, 6).map((a: any) => (
          <KpiCard
            key={a._id}
            label={a._id.replace(/_/g, ' ')}
            value={a.count}
            tone={a._id.includes('FAILED') || a._id.includes('REJECT') ? 'red' : a._id.includes('LOGIN') ? 'green' : 'blue'}
            onClick={() => setAction(a._id === action ? '' : a._id)}
          />
        ))}
      </div>

      <Panel
        title="Audit Ledger — Append-Only"
        icon={<FiFileText size={15} />}
        actions={
          <div className="row wrap" style={{ gap: 8 }}>
            <input className="input" style={{ width: 200 }} placeholder="Search ledger…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <select className="select" style={{ width: 200 }} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">All actions</option>
              {(data?.actionCounts || []).map((a: any) => <option key={a._id} value={a._id}>{a._id.replace(/_/g, ' ')}</option>)}
            </select>
            <button className="btn btn-sm" onClick={() => exportCsv('audit-ledger.csv', (data?.logs || []).map((l: any) => ({
              timestamp: l.timestamp, user: l.user, role: l.role, action: l.action, entity: l.entity, entityId: l.entityId, result: l.result, ip: l.ipAddress, details: l.details,
            })))}>
              <FiDownload size={11} /> CSV
            </button>
          </div>
        }
        bodyClass=""
      >
        {auditQ.isLoading ? (
          <Loading label="Decrypting ledger…" />
        ) : auditQ.isError ? (
          <ErrorState message={String(auditQ.error)} onRetry={() => auditQ.refetch()} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {(data?.logs || []).length === 0 && <tr><td colSpan={8}><EmptyState title="Ledger empty" hint="System actions are recorded here automatically." /></td></tr>}
                  {(data?.logs || []).map((l: any) => (
                    <tr key={l._id}>
                      <td className="mono fs-11">{formatDateTime(l.timestamp)}</td>
                      <td className="fs-12">{l.user}</td>
                      <td className="micro">{String(l.role).replace(/_/g, ' ')}</td>
                      <td><span className="badge badge-blue">{String(l.action).replace(/_/g, ' ')}</span></td>
                      <td className="fs-12">{l.entity}{l.entityId ? <span className="micro" style={{ marginLeft: 4 }}>#{String(l.entityId).slice(-6)}</span> : null}</td>
                      <td className="fs-12 text-mid truncate" style={{ maxWidth: 220 }}>{l.details || '—'}</td>
                      <td className="mono fs-11">{l.ipAddress || '—'}</td>
                      <td><StatusBadge value={l.result} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-between" style={{ padding: 12, borderTop: '1px solid var(--line-soft)' }}>
              <span className="micro">PAGE {data?.page ?? 1} · {data?.total ?? 0} RECORDS · IMMUTABLE</span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>PREV</button>
                <button className="btn btn-sm" disabled={(data?.page ?? 1) * 25 >= (data?.total ?? 0)} onClick={() => setPage(page + 1)}>NEXT</button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
