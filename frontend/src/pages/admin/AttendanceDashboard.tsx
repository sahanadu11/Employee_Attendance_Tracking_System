import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiCheckSquare, FiDownload, FiPrinter } from 'react-icons/fi';
import { dashboardAPI, attendanceAPI, employeeAPI } from '../../api';
import { Panel, KpiCard, StatusBadge, EmployeeCell, Loading, ErrorState, EmptyState, exportCsv, formatTime, minutesToLabel } from '../../components/ui';

export default function AttendanceDashboard() {
  const [fromDate, setFromDate] = useState('');
  const [flowId, setFlowId] = useState('');
  const [page, setPage] = useState(1);

  const attQ = useQuery({
    queryKey: ['dash-attendance', fromDate, flowId],
    queryFn: () => dashboardAPI.attendance({ fromDate: fromDate || undefined, flowId: flowId || undefined }),
    refetchInterval: 60_000,
  });
  const flowsQ = useQuery({ queryKey: ['flows-list'], queryFn: () => dashboardAPI.flows(), staleTime: 300_000 });
  const historyQ = useQuery({
    queryKey: ['attendance-history', page, flowId],
    queryFn: () => attendanceAPI.history({ page, limit: 15, ...(flowId ? { flowId } : {}) }),
  });
  const empsQ = useQuery({ queryKey: ['employees-lite'], queryFn: () => employeeAPI.getAll({ limit: 200 }), staleTime: 120_000 });

  const att = attQ.data?.data;
  const history = historyQ.data?.data;
  const employees = empsQ.data?.data?.employees || [];
  const empMap = new Map(employees.map((e: any) => [e._id, e]));

  const statusRows = att ? Object.entries(att.statuses || {}) : [];
  const maxDaily = Math.max(1, ...(att?.daily || []).map((d: any) => d.count));

  if (attQ.isLoading) return <Loading label="Crunching attendance ledger…" />;
  if (attQ.isError) return <ErrorState message={String(attQ.error)} onRetry={() => attQ.refetch()} />;

  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel
        title="Attendance Dashboard"
        icon={<FiCheckSquare size={15} className="text-green" />}
        actions={
          <div className="row wrap" style={{ gap: 8 }}>
            <input type="date" className="input" style={{ width: 150 }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <select className="select" style={{ width: 150 }} value={flowId} onChange={(e) => setFlowId(e.target.value)}>
              <option value="">All flows</option>
              {(flowsQ.data?.data || []).map((f: any) => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
            <button className="btn btn-sm" onClick={() => exportCsv('attendance-summary.csv', statusRows.map(([k, v]) => ({ status: k, count: v })))}>
              <FiDownload size={11} /> CSV
            </button>
            <button className="btn btn-sm" onClick={() => window.print()}><FiPrinter size={11} /> Print</button>
          </div>
        }
      >
        <div className="grid grid-kpi">
          <KpiCard label="Total Events" value={att?.total ?? 0} tone="blue" />
          <KpiCard label="On Time / Early" value={att?.present ?? 0} tone="green" />
          <KpiCard label="Late + Grace" value={att?.late ?? 0} tone="red" />
          <KpiCard label="Missed" value={att?.absent ?? 0} tone="amber" />
          <KpiCard label="Blocked" value={att?.blocked ?? 0} tone="red" />
          <KpiCard label="GPS Failures" value={att?.gpsFailure ?? 0} tone="violet" />
        </div>

        <div className="grid grid-2 mt-16">
          <div>
            <span className="micro mb-8" style={{ display: 'block' }}>STATUS BREAKDOWN</span>
            <div className="col" style={{ gap: 6 }}>
              {statusRows.length === 0 && <EmptyState title="No events in range" />}
              {statusRows.map(([k, v]) => (
                <div key={k} className="row-between" style={{ padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                  <StatusBadge value={k} />
                  <span className="mono fs-13">{v as number}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="micro mb-8" style={{ display: 'block' }}>14-DAY TREND</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 }}>
              {(att?.daily || []).map((d: any) => (
                <div key={d.date} title={`${d.date}: ${d.count} events (${d.late} late)`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', gap: 2 }}>
                  {d.late > 0 && <div style={{ height: `${(d.late / maxDaily) * 100}%`, background: 'var(--red)', borderRadius: 2 }} />}
                  <div style={{ height: `${((d.count - d.late) / maxDaily) * 100}%`, background: 'var(--accent)', borderRadius: 2, minHeight: 2 }} />
                </div>
              ))}
              {(att?.daily || []).length === 0 && <EmptyState title="No history" />}
            </div>
            <div className="row-between mt-8">
              <span className="micro">LATE IN RED</span>
              <span className="micro">{att?.avgLateMinutes ?? 0}M AVG LATE</span>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Recent Attendance Records" bodyClass="">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Event</th><th>Shift</th><th>Status</th><th>Late</th><th>Sched</th><th>Actual</th><th>GPS</th></tr>
            </thead>
            <tbody>
              {(history?.events || []).length === 0 && <tr><td colSpan={8}><EmptyState title="No records" /></td></tr>}
              {(history?.events || []).map((ev: any) => (
                <tr key={ev._id}>
                  <td><EmployeeCell photo={ev.employeeId?.photo} name={ev.employeeId?.fullName} code={ev.employeeId?.employeeId} /></td>
                  <td className="fs-12">{ev.eventTypeId?.name}</td>
                  <td className="fs-12 text-mid">{ev.shiftId?.name}</td>
                  <td><StatusBadge value={ev.status} /></td>
                  <td className="mono fs-12">{ev.lateDurationMinutes ? `+${ev.lateDurationMinutes}m` : '—'}</td>
                  <td className="mono fs-12">{formatTime(ev.scheduledTime)}</td>
                  <td className="mono fs-12">{formatTime(ev.actualTime)}</td>
                  <td><StatusBadge value={ev.gpsStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row-between" style={{ padding: 12, borderTop: '1px solid var(--line-soft)' }}>
          <span className="micro">PAGE {history?.page ?? 1} · {history?.total ?? 0} RECORDS</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>PREV</button>
            <button className="btn btn-sm" disabled={page * 15 >= (history?.total ?? 0)} onClick={() => setPage(page + 1)}>NEXT</button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
