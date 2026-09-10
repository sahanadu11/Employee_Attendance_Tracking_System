import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiActivity } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, StatusBadge, Loading, ErrorState, EmptyState } from '../../components/ui';

export default function SystemHealthDashboard() {
  const healthQ = useQuery({ queryKey: ['dash-health'], queryFn: dashboardAPI.systemHealth, refetchInterval: 15_000 });
  const data = healthQ.data?.data;

  if (healthQ.isLoading) return <Loading label="Probing subsystems…" />;
  if (healthQ.isError) return <ErrorState message={String(healthQ.error)} onRetry={() => healthQ.refetch()} />;

  const mins = Math.floor((data?.uptimeSeconds || 0) / 60);
  const hours = Math.floor(mins / 60);

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Database" value={<StatusBadge value={data?.database?.status} dot />} sub={data?.database?.name} tone={data?.database?.status === 'UP' ? 'green' : 'red'} />
        <KpiCard label="WebSocket" value={<StatusBadge value={data?.websocket?.status} dot />} sub={data?.websocket?.transport} tone="blue" />
        <KpiCard label="Storage" value={<StatusBadge value={data?.storage?.status} dot />} sub={data?.storage?.provider} tone="cyan" />
        <KpiCard label="Uptime" value={hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`} sub={`node ${data?.nodeVersion}`} tone="violet" />
        <KpiCard label="Events Today" value={data?.stats?.eventsToday ?? 0} tone="blue" sub={`${data?.stats?.errorRatePct ?? 0}% error rate`} />
        <KpiCard label="Active Sessions" value={data?.stats?.activeSessions ?? 0} tone="cyan" />
      </div>

      <div className="grid grid-2">
        <Panel title="Runtime Environment" icon={<FiActivity size={15} />}>
          <div className="col" style={{ gap: 8 }}>
            {[
              ['Environment', data?.env],
              ['Node version', data?.nodeVersion],
              ['Configured settings', data?.stats?.configuredSettings],
              ['Audit records', data?.stats?.auditRecords],
              ['Error events today', data?.stats?.errorEvents],
            ].map(([k, v]) => (
              <div key={String(k)} className="row-between" style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                <span className="micro">{String(k).toUpperCase()}</span>
                <span className="mono fs-13">{String(v ?? '—')}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Acceptable Operating Envelope">
          <div className="col" style={{ gap: 8 }}>
            {[
              ['Database', 'MongoDB replica-set recommended in production', true],
              ['WebSocket', 'Single-node Socket.IO — use Redis adapter to scale horizontally', true],
              ['Storage', 'Local disk in development; object storage in production', true],
              ['Rate limiting', 'Express rate-limiter active on /api', true],
            ].map(([k, v, ok]) => (
              <div key={String(k)} className="row" style={{ gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                <span className={`badge ${ok ? 'badge-green' : 'badge-amber'}`}>{ok ? 'OK' : 'CHECK'}</span>
                <div className="col" style={{ gap: 1 }}>
                  <span className="fs-13" style={{ fontWeight: 600 }}>{k}</span>
                  <span className="fs-11 text-low">{v}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
