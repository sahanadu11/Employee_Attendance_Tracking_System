import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiShield, FiUnlock, FiAlertTriangle } from 'react-icons/fi';
import { dashboardAPI, lockAPI } from '../../api';
import { Panel, KpiCard, StatusBadge, Loading, ErrorState, EmptyState, formatDateTime, formatTime } from '../../components/ui';

export default function SecurityDashboard() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const secQ = useQuery({ queryKey: ['dash-security'], queryFn: dashboardAPI.security, refetchInterval: 30_000 });
  const data = secQ.data?.data;
  const counts = data?.counts || {};

  const unlock = async (userId: string) => {
    await lockAPI.unlock(userId);
    qc.invalidateQueries({ queryKey: ['dash-security'] });
  };

  if (secQ.isLoading) return <Loading label="Pulling security ledger…" />;
  if (secQ.isError) return <ErrorState message={String(secQ.error)} onRetry={() => secQ.refetch()} />;

  const events = (data?.recentEvents || []).filter((e: any) =>
    !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.eventType?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Failed Logins" value={counts.failedLogins ?? 0} tone="amber" sub="today" />
        <KpiCard label="Lockouts" value={counts.lockouts ?? 0} tone="red" sub="3-strike policy breaches" />
        <KpiCard label="GPS Suspicious" value={counts.suspiciousGps ?? 0} tone="violet" sub="outside geofence submissions" />
        <KpiCard label="Invalid Events" value={counts.invalidEvents ?? 0} tone="amber" sub="sequence violations" />
        <KpiCard label="Unauthorized" value={counts.unauthorized ?? 0} tone="red" sub="access attempts" />
        <KpiCard label="Admin Changes" value={counts.adminChanges ?? 0} tone="blue" sub="configuration edits" />
      </div>

      <Panel
        title="Active Account Lockouts"
        icon={<FiLock size={15} className="text-red" />}
        actions={<span className="badge badge-red">POLICY: 3-FAILED LOCK</span>}
        bodyClass=""
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>User / Badge</th><th>Role</th><th>Section</th><th>Failed Attempts</th><th>Locked At</th><th>Unlocks In</th><th>Admin Action</th></tr>
            </thead>
            <tbody>
              {(data?.lockedAccounts || []).length === 0 && (
                <tr><td colSpan={7}><EmptyState title="No active lockouts" hint="All accounts are operational." /></td></tr>
              )}
              {(data?.lockedAccounts || []).map((u: any) => (
                <tr key={u._id} className="row-danger">
                  <td>
                    <div className="col" style={{ gap: 1 }}>
                      <span style={{ fontWeight: 700 }}>{u.email}</span>
                      <span className="micro">{u.employeeCode || '—'}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-gray">{u.role.replace(/_/g, ' ')}</span></td>
                  <td className="fs-12 text-mid">{u.section || u.flow || '—'}</td>
                  <td><span className="badge badge-red">{u.failedAttempts}/3</span></td>
                  <td className="mono fs-12">{formatTime(u.lockedUntil)}</td>
                  <td className="mono fs-12 text-amber">{u.lockMinutesRemaining}m</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => unlock(u._id)}>
                      <FiUnlock size={11} /> UNLOCK
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line-soft)' }}>
          <span className="micro">Every unlock action is recorded to the audit ledger with your identity</span>
        </div>
      </Panel>

      <Panel
        title="Security Event Ledger"
        icon={<FiShield size={15} />}
        actions={
          <input className="input" style={{ width: 220 }} placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} />
        }
        bodyClass=""
      >
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Type</th><th>Description</th><th>User</th><th>IP</th><th>Device</th><th>Timestamp</th><th>State</th></tr></thead>
            <tbody>
              {events.length === 0 && <tr><td colSpan={7}><EmptyState title="No security events" /></td></tr>}
              {events.slice(0, 40).map((e: any) => (
                <tr key={e._id}>
                  <td>
                    <span className={`badge ${
                      e.eventType === 'LOCKOUT' || e.eventType === 'UNAUTHORIZED_ACCESS' ? 'badge-red'
                      : e.eventType === 'GPS_SUSPICIOUS' ? 'badge-violet'
                      : e.eventType === 'ADMIN_CHANGE' ? 'badge-blue'
                      : 'badge-amber'
                    }`}>{e.eventType.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="fs-12">{e.description}</td>
                  <td className="fs-12 text-mid">{e.userId?.email || '—'}</td>
                  <td className="mono fs-12">{e.ipAddress || '—'}</td>
                  <td className="fs-12 text-low truncate" style={{ maxWidth: 160 }}>{e.userAgent || '—'}</td>
                  <td className="mono fs-12">{formatDateTime(e.timestamp)}</td>
                  <td><StatusBadge value={e.isResolved ? 'SUCCESS' : 'FAILURE'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FiLock(props: any) { return <FiShield {...props} />; }
