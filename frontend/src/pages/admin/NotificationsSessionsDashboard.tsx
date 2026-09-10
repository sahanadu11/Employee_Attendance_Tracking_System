import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiBell, FiMonitor, FiCheck } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, StatusBadge, Loading, ErrorState, EmptyState, formatDateTime, minutesToLabel, exportCsv } from '../../components/ui';

/* ============ NOTIFICATION DASHBOARD ============ */

export function NotificationsDashboard() {
  const qc = useQueryClient();
  const [type, setType] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const notifQ = useQuery({
    queryKey: ['dash-notifications', type, unreadOnly],
    queryFn: () => dashboardAPI.notifications({ type: type || undefined, unreadOnly }),
    refetchInterval: 30_000,
  });
  const data = notifQ.data?.data;

  const acknowledge = async (id: string) => {
    await dashboardAPI.acknowledgeNotification(id);
    qc.invalidateQueries({ queryKey: ['dash-notifications'] });
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        {(data?.typeCounts || []).slice(0, 6).map((t: any) => (
          <KpiCard key={t._id} label={t._id.replace(/_/g, ' ')} value={t.count} tone={t._id.includes('LATE') ? 'red' : t._id.includes('GPS') || t._id.includes('OUTSIDE') ? 'violet' : 'amber'} onClick={() => setType(t._id === type ? '' : t._id)} />
        ))}
        <KpiCard label="Unread" value={data?.unreadCount ?? 0} tone="cyan" onClick={() => setUnreadOnly(!unreadOnly)} sub={unreadOnly ? 'FILTER ON' : 'click to filter'} />
      </div>

      <Panel
        title="Notification Feed"
        icon={<FiBell size={15} className="text-amber" />}
        actions={
          <div className="row wrap" style={{ gap: 8 }}>
            <button className={`btn btn-sm ${unreadOnly ? 'btn-primary' : ''}`} onClick={() => setUnreadOnly(!unreadOnly)}>UNREAD ONLY</button>
            <select className="select" style={{ width: 190 }} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {['LATE', 'OUTSIDE_GEOFENCE', 'GPS_FAILURE', 'ACCOUNT_LOCK', 'MISSED_EVENT', 'ATTENDANCE_EXCEPTION', 'ADMIN_ACTION', 'SYSTEM_WARNING'].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        }
        bodyClass=""
      >
        {notifQ.isLoading ? (
          <Loading label="Fetching alert stream…" />
        ) : (data?.notifications || []).length === 0 ? (
          <EmptyState title="Inbox zero" hint="No notifications match the current filter." />
        ) : (
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {(data?.notifications || []).map((n: any) => (
              <div key={n._id} className={`event-card ${!n.isRead ? 'fresh' : ''}`}>
                <div className="grow col" style={{ gap: 3 }}>
                  <div className="row-between wrap" style={{ gap: 6 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className={`badge ${
                        n.type === 'LATE' ? 'badge-red'
                        : n.type === 'OUTSIDE_GEOFENCE' || n.type === 'GPS_FAILURE' ? 'badge-violet'
                        : n.type === 'ACCOUNT_LOCK' ? 'badge-red'
                        : 'badge-amber'
                      }`}>{n.type.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{n.title}</span>
                    </div>
                    <span className="micro">{formatDateTime(n.timestamp)}</span>
                  </div>
                  <div className="fs-12 text-mid">{n.message}</div>
                  <div className="row-between">
                    <span className="micro">{n.userId?.email || '—'}</span>
                    {!n.isRead ? (
                      <button className="btn btn-sm" onClick={() => acknowledge(n._id)}><FiCheck size={11} /> ACK</button>
                    ) : (
                      <span className="badge badge-green">ACKNOWLEDGED</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ============ SESSIONS DASHBOARD ============ */

export function SessionsDashboard() {
  const qc = useQueryClient();
  const sessionsQ = useQuery({ queryKey: ['dash-sessions'], queryFn: dashboardAPI.sessions, refetchInterval: 30_000 });
  const data = sessionsQ.data?.data;

  const revoke = async (id: string) => {
    await dashboardAPI.revokeSession(id);
    qc.invalidateQueries({ queryKey: ['dash-sessions'] });
  };

  if (sessionsQ.isLoading) return <Loading label="Enumerating active sessions…" />;
  if (sessionsQ.isError) return <ErrorState message={String(sessionsQ.error)} onRetry={() => sessionsQ.refetch()} />;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Active Sessions" value={data?.activeCount ?? 0} tone="green" icon={<FiMonitor size={15} />} />
        <KpiCard
          label="Idle > 30m"
          value={(data?.sessions || []).filter((s: any) => s.idleMinutes > 30).length}
          tone="amber"
          sub="candidate for revoke"
        />
      </div>

      <Panel
        title="Device & Session Control"
        actions={
          <button
            className="btn btn-sm"
            onClick={() => exportCsv('active-sessions.csv', (data?.sessions || []).map((s: any) => ({
              user: s.user, role: s.role, device: s.device, ip: s.ipAddress, loginAt: s.loginAt, lastActivity: s.lastActivityAt, idleMinutes: s.idleMinutes,
            })))}
          >
            CSV
          </button>
        }
        bodyClass=""
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Device</th><th>IP</th><th>Login</th><th>Last Activity</th><th>Idle</th><th>State</th><th>Action</th></tr>
            </thead>
            <tbody>
              {(data?.sessions || []).length === 0 && <tr><td colSpan={9}><EmptyState title="No active sessions" /></td></tr>}
              {(data?.sessions || []).map((s: any) => (
                <tr key={s._id}>
                  <td>
                    <div className="col" style={{ gap: 1 }}>
                      <span style={{ fontWeight: 600 }}>{s.user}</span>
                      <span className="micro">{s.employeeCode || '—'}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-gray">{String(s.role).replace(/_/g, ' ')}</span></td>
                  <td className="fs-12 text-mid">
                    {s.device?.browser} · {s.device?.platform}
                  </td>
                  <td className="mono fs-12">{s.ipAddress}</td>
                  <td className="mono fs-11">{formatDateTime(s.loginAt)}</td>
                  <td className="mono fs-11">{formatDateTime(s.lastActivityAt)}</td>
                  <td className="mono fs-12">{s.idleMinutes < 60 ? `${s.idleMinutes}m` : minutesToLabel(s.idleMinutes)}</td>
                  <td><StatusBadge value="ACTIVE" /></td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => revoke(s._id)}>REVOKE</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
