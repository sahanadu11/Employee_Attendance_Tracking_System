import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiList } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, StatusBadge, Loading, ErrorState, EmptyState } from '../../components/ui';

export default function EventEngineDashboard() {
  const eventsQ = useQuery({ queryKey: ['dash-events'], queryFn: dashboardAPI.events, refetchInterval: 60_000 });
  const data = eventsQ.data?.data;

  if (eventsQ.isLoading) return <Loading label="Loading event definitions…" />;
  if (eventsQ.isError) return <ErrorState message={String(eventsQ.error)} onRetry={() => eventsQ.refetch()} />;

  const totalCompleted = (data || []).reduce((a: number, e: any) => a + e.completedCount, 0);
  const totalFailed = (data || []).reduce((a: number, e: any) => a + e.failedCount, 0);
  const totalGpsFail = (data || []).reduce((a: number, e: any) => a + e.gpsFailures, 0);

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Event Types" value={data?.length ?? 0} tone="blue" icon={<FiList size={15} />} />
        <KpiCard label="Events Today" value={totalCompleted} tone="green" />
        <KpiCard label="Failed / Blocked" value={totalFailed} tone="red" />
        <KpiCard label="GPS Failures" value={totalGpsFail} tone="violet" />
      </div>

      <Panel title="Event Sequence Engine — Today's Performance" bodyClass="">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Event</th><th>Type</th><th>Window</th><th>Completed</th><th>Pending</th><th>Late</th><th>Failed</th><th>GPS Fail</th><th>Face Fail</th><th>Requirements</th><th>State</th></tr>
            </thead>
            <tbody>
              {(data || []).map((e: any) => (
                <tr key={e._id}>
                  <td><span className="chip chip-blue">{e.sequenceNumber}</span></td>
                  <td>
                    <div className="col" style={{ gap: 1 }}>
                      <span style={{ fontWeight: 700 }}>{e.name}</span>
                      <span className="micro">{e.code}</span>
                    </div>
                  </td>
                  <td className="fs-12">{String(e.eventType).replace(/_/g, ' ')}</td>
                  <td className="mono fs-12">{e.allowedWindowMinutes ?? '—'}m</td>
                  <td><span className="badge badge-green">{e.completedCount}</span></td>
                  <td><span className="badge badge-gray">{e.pendingCount}</span></td>
                  <td>{e.lateCount > 0 ? <span className="badge badge-red">{e.lateCount}</span> : <span className="micro">0</span>}</td>
                  <td>{e.failedCount > 0 ? <span className="badge badge-red">{e.failedCount}</span> : <span className="micro">0</span>}</td>
                  <td>{e.gpsFailures > 0 ? <span className="badge badge-amber">{e.gpsFailures}</span> : <span className="micro">0</span>}</td>
                  <td>{e.faceFailures > 0 ? <span className="badge badge-violet">{e.faceFailures}</span> : <span className="micro">0</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {e.requiresPhoto && <span className="badge badge-blue">PHOTO</span>}
                      {e.requiresGps && <span className="badge badge-cyan">GPS</span>}
                      {e.requiresFaceVerification && <span className="badge badge-violet">FACE</span>}
                      {!e.requiresPhoto && !e.requiresGps && !e.requiresFaceVerification && <span className="micro">NONE</span>}
                    </div>
                  </td>
                  <td><StatusBadge value={e.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                </tr>
              ))}
              {(data || []).length === 0 && <tr><td colSpan={12}><EmptyState title="No event types configured" /></td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line-soft)' }}>
          <span className="micro">EVENT FLOW: {((data || [])[0]?.code) || 'LOGIN'} → {((data || [])[1]?.code) || 'LUNCH_OUT'} → {((data || [])[2]?.code) || 'LUNCH_IN'} → {((data || [])[3]?.code) || 'TEA_OUT'} → {((data || [])[4]?.code) || 'TEA_IN'} → {((data || [])[5]?.code) || 'SIGN_OUT'} → CUSTOM EVENTS</span>
        </div>
      </Panel>
    </div>
  );
}
