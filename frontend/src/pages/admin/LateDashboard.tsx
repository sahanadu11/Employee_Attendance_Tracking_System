import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiAlertTriangle, FiDownload } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, StatusBadge, GpsChip, Avatar, Loading, ErrorState, EmptyState, exportCsv, formatTime, minutesToLabel, EmployeeCell } from '../../components/ui';

export default function LateDashboard() {
  const [sortBy, setSortBy] = useState('most');

  const lateQ = useQuery({
    queryKey: ['dash-late', sortBy],
    queryFn: () => dashboardAPI.late({ sortBy }),
    refetchInterval: 60_000,
  });

  const data = lateQ.data?.data;

  if (lateQ.isLoading) return <Loading label="Scanning late registry…" />;
  if (lateQ.isError) return <ErrorState message={String(lateQ.error)} onRetry={() => lateQ.refetch()} />;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Late Today" value={data?.count ?? 0} tone="red" icon={<FiAlertTriangle size={15} />} />
        <KpiCard label="Avg Late" value={`${data?.avgLateMinutes ?? 0}m`} tone="amber" sub="mean minutes beyond schedule" />
        <KpiCard label="Worst Case" value={`${data?.maxLateMinutes ?? 0}m`} tone="red" sub="single worst offender" />
      </div>

      <div className="grid grid-3">
        <Panel title="Late by Section"><BarList rows={data?.bySection || []} /></Panel>
        <Panel title="Late by Flow"><BarList rows={data?.byFlow || []} tone="var(--cyan)" /></Panel>
        <Panel title="Late by Shift"><BarList rows={data?.byShift || []} tone="var(--amber)" /></Panel>
      </div>

      <Panel
        title="Late Personnel Register"
        icon={<FiAlertTriangle size={15} className="text-red" />}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <select className="select" style={{ width: 160 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="most">Most late first</option>
              <option value="least">Least late first</option>
            </select>
            <button
              className="btn btn-sm"
              onClick={() => exportCsv('late-attendance.csv', (data?.employees || []).map((e: any) => ({
                name: e.employeeName, code: e.employeeCode, section: e.section, flow: e.flow, shift: e.shift,
                scheduled: formatTime(e.scheduledTime), actual: formatTime(e.actualTime), lateMinutes: e.lateMinutes, gps: e.gpsStatus,
              })))}
            >
              <FiDownload size={11} /> CSV
            </button>
          </div>
        }
        bodyClass=""
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Section</th><th>Flow</th><th>Shift</th><th>Scheduled</th><th>Actual</th><th>Late By</th><th>GPS</th></tr>
            </thead>
            <tbody>
              {(data?.employees || []).length === 0 && (
                <tr><td colSpan={8}><EmptyState title="Zero late arrivals" hint="Every checked-in employee made it inside the grace window. Outstanding discipline." /></td></tr>
              )}
              {(data?.employees || []).map((e: any) => (
                <tr key={e._id} className="row-danger">
                  <td><EmployeeCell photo={e.photo} name={e.employeeName} code={e.employeeCode} /></td>
                  <td className="fs-12">{e.section}</td>
                  <td className="fs-12">{e.flow}</td>
                  <td className="fs-12 text-mid">{e.shift}</td>
                  <td className="mono fs-12">{formatTime(e.scheduledTime)}</td>
                  <td className="mono fs-12">{formatTime(e.actualTime)}</td>
                  <td>
                    <span className="badge badge-red">LATE BY {minutesToLabel(e.lateMinutes)}</span>
                  </td>
                  <td><GpsChip status={e.gpsStatus} accuracy={e.gpsAccuracy} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function BarList({ rows, tone = 'var(--red)' }: { rows: any[]; tone?: string }) {
  if (!rows.length) return <EmptyState title="No data" />;
  const max = Math.max(1, ...rows.map((r: any) => r.count));
  return (
    <div className="col" style={{ gap: 9 }}>
      {rows.map((r: any, i: number) => (
        <div key={i}>
          <div className="row-between" style={{ marginBottom: 3 }}>
            <span className="fs-12 truncate">{r.label}</span>
            <span className="mono fs-11 text-mid">{r.count} · avg {r.avg}m</span>
          </div>
          <div style={{ height: 7, background: 'var(--bg-elevated)', borderRadius: 4 }}>
            <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', background: tone, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
