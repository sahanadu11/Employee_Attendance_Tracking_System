import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiCoffee, FiAlertTriangle } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, StateBadge, Avatar, Loading, ErrorState, EmptyState, formatTime, minutesToLabel, EmployeeCell } from '../../components/ui';

export default function BreakDashboard() {
  const breaksQ = useQuery({ queryKey: ['dash-breaks'], queryFn: dashboardAPI.breaks, refetchInterval: 20_000 });

  const data = breaksQ.data?.data;
  const lunchTotal = data?.totals?.find((t: any) => t.type === 'LUNCH_OUT');
  const teaTotal = data?.totals?.find((t: any) => t.type === 'TEA_OUT');
  const exceeded = (data?.missingReturn || []).filter((m: any) => m.exceeded).length;

  if (breaksQ.isLoading) return <Loading label="Syncing break telemetry…" />;
  if (breaksQ.isError) return <ErrorState message={String(breaksQ.error)} onRetry={() => breaksQ.refetch()} />;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="On Break Now" value={data?.currentlyOnBreak?.length ?? 0} tone="cyan" icon={<FiCoffee size={15} />} sub={`${data?.currentlyOnBreak?.filter((b: any) => b.state === 'ON_LUNCH').length ?? 0} lunch · ${data?.currentlyOnBreak?.filter((b: any) => b.state === 'ON_TEA').length ?? 0} tea`} />
        <KpiCard label="Lunch Sessions" value={lunchTotal?.count ?? 0} tone="blue" sub={`avg ${minutesToLabel(lunchTotal?.avgDurationMinutes)}`} footLeft={`${lunchTotal?.exceededCount ?? 0} OVER-LIMIT`} />
        <KpiCard label="Tea Sessions" value={teaTotal?.count ?? 0} tone="cyan" sub={`avg ${minutesToLabel(teaTotal?.avgDurationMinutes)}`} footLeft={`${teaTotal?.exceededCount ?? 0} OVER-LIMIT`} />
        <KpiCard label="Break Exceeded" value={exceeded} tone="red" icon={<FiAlertTriangle size={15} />} sub="past allowed duration, no return event" />
      </div>

      <div className="grid grid-2">
        <Panel title="Currently On Break" icon={<span className="live-dot green" />} bodyClass="">
          {(data?.currentlyOnBreak || []).length === 0 ? (
            <EmptyState title="Nobody on break" hint="All present personnel are at their stations." />
          ) : (
            (data?.currentlyOnBreak || []).map((b: any, i: number) => (
              <div key={i} className="event-card">
                <Avatar photo={b.employee.photo} name={b.employee.fullName} size="md" />
                <div className="grow">
                  <div className="row-between">
                    <span style={{ fontWeight: 700 }}>{b.employee.fullName}</span>
                    <StateBadge state={b.state} />
                  </div>
                  <div className="fs-12 text-mid">{b.employee.flow} · {b.employee.shift}</div>
                  <div className="fs-12 text-low">{b.lastEvent?.name} at {formatTime(b.lastEvent?.time)}</div>
                </div>
              </div>
            ))
          )}
        </Panel>

        <Panel title="Missing Return / Over-Run" icon={<FiAlertTriangle size={14} className="text-red" />} bodyClass="">
          {(data?.missingReturn || []).length === 0 ? (
            <EmptyState title="All breaks closed" hint="Every break-out has a matching return event." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Employee</th><th>Type</th><th>Out At</th><th>Elapsed</th><th>Allowed</th><th>State</th></tr></thead>
                <tbody>
                  {data.missingReturn.map((m: any) => (
                    <tr key={m.breakId} className={m.exceeded ? 'row-danger' : ''}>
                      <td><EmployeeCell photo={m.photo} name={m.employeeName} code={m.employeeCode} /></td>
                      <td className="fs-12">{m.type === 'LUNCH_OUT' ? 'LUNCH' : 'TEA'}</td>
                      <td className="mono fs-12">{formatTime(m.breakStart)}</td>
                      <td className="mono fs-12">{minutesToLabel(m.elapsedMinutes)}</td>
                      <td className="mono fs-12">{minutesToLabel(m.allowedDurationMinutes)}</td>
                      <td>{m.exceeded ? <span className="badge badge-red">EXCEEDED</span> : <span className="badge badge-green">IN WINDOW</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Recent Break Ledger" bodyClass="">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Duration</th><th>Allowed</th><th>Excess</th><th>Shift</th><th>GPS</th></tr></thead>
            <tbody>
              {(data?.recent || []).length === 0 && <tr><td colSpan={9}><EmptyState title="No break records today" /></td></tr>}
              {(data?.recent || []).map((b: any) => (
                <tr key={b._id}>
                  <td><EmployeeCell photo={b.photo} name={b.employeeName} code={b.employeeCode} /></td>
                  <td><span className={`badge ${b.eventType === 'LUNCH_OUT' ? 'badge-blue' : 'badge-cyan'}`}>{b.eventType === 'LUNCH_OUT' ? 'LUNCH' : 'TEA'}</span></td>
                  <td className="mono fs-12">{formatTime(b.breakStart)}</td>
                  <td className="mono fs-12">{b.breakEnd ? formatTime(b.breakEnd) : <span className="text-amber">OPEN</span>}</td>
                  <td className="mono fs-12">{b.totalDurationMinutes != null ? minutesToLabel(b.totalDurationMinutes) : '—'}</td>
                  <td className="mono fs-12">{minutesToLabel(b.allowedDurationMinutes)}</td>
                  <td>{b.excessDurationMinutes > 0 ? <span className="badge badge-red">+{minutesToLabel(b.excessDurationMinutes)}</span> : <span className="badge badge-green">OK</span>}</td>
                  <td className="fs-12 text-mid">{b.shift}</td>
                  <td className="fs-12">{b.gpsStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
