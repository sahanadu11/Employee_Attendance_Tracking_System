import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiBarChart2, FiDownload, FiPrinter } from 'react-icons/fi';
import { dashboardAPI, reportAPI, attendanceAPI, employeeAPI } from '../../api';
import { Panel, StatusBadge, EmployeeCell, Loading, ErrorState, EmptyState, exportCsv, formatTime, minutesToLabel, KpiCard } from '../../components/ui';

type ReportKind = 'daily' | 'monthly' | 'late' | 'breaks' | 'security';

const REPORTS: { kind: ReportKind; label: string; description: string }[] = [
  { kind: 'daily', label: 'Daily Attendance', description: 'Every event today with schedule deltas and GPS state' },
  { kind: 'monthly', label: 'Monthly Summary', description: 'Aggregated attendance totals across the last 30 days' },
  { kind: 'late', label: 'Late Register', description: 'Late arrivals with durations, sorted worst-first' },
  { kind: 'breaks', label: 'Break Violations', description: 'Lunch and tea breaks exceeding allowed durations' },
  { kind: 'security', label: 'Security Exceptions', description: 'Lockouts, failed logins, and GPS anomalies' },
];

export default function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('daily');

  const overviewQ = useQuery({ queryKey: ['dash-overview'], queryFn: dashboardAPI.overview, staleTime: 60_000 });
  const dailyQ = useQuery({ queryKey: ['rep-daily'], queryFn: () => reportAPI.daily(), enabled: kind === 'daily' });
  const monthlyQ = useQuery({ queryKey: ['rep-monthly'], queryFn: () => reportAPI.monthly(), enabled: kind === 'monthly' });
  const lateQ = useQuery({ queryKey: ['dash-late', 'most'], queryFn: () => dashboardAPI.late({ sortBy: 'most' }), enabled: kind === 'late' });
  const breaksQ = useQuery({ queryKey: ['dash-breaks'], queryFn: dashboardAPI.breaks, enabled: kind === 'breaks' });
  const securityQ = useQuery({ queryKey: ['dash-security'], queryFn: dashboardAPI.security, enabled: kind === 'security' });

  const loading = [dailyQ, monthlyQ, lateQ, breaksQ, securityQ].some((q) => q.isLoading && q.fetchStatus !== 'idle');
  const error = [dailyQ, monthlyQ, lateQ, breaksQ, securityQ].find((q) => q.isError);

  const rows: Record<string, unknown>[] = useMemo(() => {
    switch (kind) {
      case 'daily': {
        const events = dailyQ.data?.data?.events || dailyQ.data?.data || [];
        return (Array.isArray(events) ? events : []).map((ev: any) => ({
          Date: new Date(ev.actualTime).toLocaleDateString(),
          Employee: ev.employeeId?.fullName || ev.employeeName,
          Code: ev.employeeId?.employeeId || ev.employeeCode,
          Event: ev.eventTypeId?.name || ev.event,
          Status: ev.status,
          Scheduled: ev.scheduledTime ? formatTime(ev.scheduledTime) : '—',
          Actual: formatTime(ev.actualTime),
          'Late (min)': ev.lateDurationMinutes ?? 0,
          GPS: ev.gpsStatus,
          'Accuracy (m)': ev.gpsAccuracy ?? '',
        }));
      }
      case 'monthly': {
        const data = monthlyQ.data?.data;
        return (data?.daily || data?.weeks || []).map((d: any) => ({
          Date: d.date || d._id,
          Events: d.count ?? d.total,
          Late: d.late ?? 0,
          'On Time': d.present ?? d.onTime ?? 0,
        }));
      }
      case 'late':
        return (lateQ.data?.data?.employees || []).map((e: any) => ({
          Employee: e.employeeName, Code: e.employeeCode, Section: e.section, Flow: e.flow, Shift: e.shift,
          Scheduled: formatTime(e.scheduledTime), Actual: formatTime(e.actualTime), 'Late (min)': e.lateMinutes, GPS: e.gpsStatus,
        }));
      case 'breaks':
        return (breaksQ.data?.data?.recent || []).map((b: any) => ({
          Employee: b.employeeName, Code: b.employeeCode, Type: b.eventType, Start: formatTime(b.breakStart), End: b.breakEnd ? formatTime(b.breakEnd) : 'OPEN',
          'Duration (min)': b.totalDurationMinutes ?? '', 'Allowed (min)': b.allowedDurationMinutes, 'Excess (min)': b.excessDurationMinutes ?? 0,
        }));
      case 'security':
        return (securityQ.data?.data?.recentEvents || []).map((e: any) => ({
          Type: e.eventType, Description: e.description, User: e.userId?.email || '', IP: e.ipAddress || '', Timestamp: formatTime(e.timestamp), Resolved: e.isResolved ? 'YES' : 'NO',
        }));
      default:
        return [];
    }
  }, [kind, dailyQ.data, monthlyQ.data, lateQ.data, breaksQ.data, securityQ.data]);

  const active = REPORTS.find((r) => r.kind === kind)!;
  const cards = overviewQ.data?.data?.cards;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Present Today" value={cards?.present ?? '—'} tone="green" />
        <KpiCard label="Late Today" value={cards?.late ?? '—'} tone="red" />
        <KpiCard label="Absent Today" value={cards?.absent ?? '—'} tone="amber" />
        <KpiCard label="On Break" value={cards?.onBreak ?? '—'} tone="cyan" />
        <KpiCard label="Exceptions" value={cards?.pendingExceptions ?? '—'} tone="violet" />
      </div>

      <Panel
        title="Reports Center"
        icon={<FiBarChart2 size={15} />}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm btn-primary" disabled={rows.length === 0} onClick={() => exportCsv(`${kind}-report-${new Date().toISOString().slice(0, 10)}.csv`, rows)}>
              <FiDownload size={11} /> CSV
            </button>
            <button className="btn btn-sm" disabled={rows.length === 0} onClick={() => window.print()}>
              <FiPrinter size={11} /> PRINT / PDF
            </button>
          </div>
        }
        bodyClass=""
      >
        <div className="row wrap" style={{ gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--line-soft)' }}>
          {REPORTS.map((r) => (
            <button key={r.kind} className={`btn btn-sm ${kind === r.kind ? 'btn-primary' : ''}`} onClick={() => setKind(r.kind)} title={r.description}>
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-soft)' }}>
          <span className="micro">{active.description.toUpperCase()} · {rows.length} ROWS</span>
        </div>

        {loading ? (
          <Loading label="Generating report…" />
        ) : error ? (
          <ErrorState message={String(error.error)} onRetry={() => (error as any).refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No data for this report" hint="Try a different report kind or date range." />
        ) : (
          <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>{Object.keys(rows[0]).map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => (
                      <td key={j} className={j === 0 ? 'fs-12' : 'mono fs-12'}>
                        {typeof v === 'string' && ['ON_TIME', 'LATE', 'EARLY', 'GRACE_PERIOD', 'BLOCKED', 'GPS_FAILURE', 'INSIDE', 'OUTSIDE', 'INACCURATE'].includes(v) ? <StatusBadge value={v} /> : String(v ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
