import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiClock } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, StateBadge, GpsChip, Avatar, Loading, ErrorState, EmptyState, formatTime, minutesToLabel } from '../../components/ui';

export default function ShiftsDashboard() {
  const shiftsQ = useQuery({ queryKey: ['dash-shifts'], queryFn: dashboardAPI.shifts, refetchInterval: 30_000 });
  const [selected, setSelected] = useState<string | null>(null);
  const data = shiftsQ.data?.data;

  if (shiftsQ.isLoading) return <Loading label="Syncing shift engine…" />;
  if (shiftsQ.isError) return <ErrorState message={String(shiftsQ.error)} onRetry={() => shiftsQ.refetch()} />;

  const shifts = data || [];
  const selectedShift = shifts.find((s: any) => s._id === selected);
  const totals = shifts.reduce(
    (acc: any, s: any) => ({ employees: acc.employees + s.employeeCount, late: acc.late + s.late, absent: acc.absent + s.absent }),
    { employees: 0, late: 0, absent: 0 }
  );

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Shifts Configured" value={shifts.length} tone="blue" icon={<FiClock size={15} />} />
        <KpiCard label="Personnel Scheduled" value={totals.employees} tone="cyan" />
        <KpiCard label="Late (All Shifts)" value={totals.late} tone="red" />
        <KpiCard label="Absent (All Shifts)" value={totals.absent} tone="amber" />
      </div>

      <Panel title="Six-Shift Overview" bodyClass="">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Shift</th><th>Start</th><th>End</th><th>Grace</th><th>Late Thr.</th><th>Employees</th><th>Present</th><th>Late</th><th>Absent</th><th>Break</th><th>Signed Out</th><th>GPS Issues</th><th>Completion</th><th></th></tr>
            </thead>
            <tbody>
              {shifts.map((s: any) => (
                <tr key={s._id}>
                  <td>
                    <div className="col" style={{ gap: 1 }}>
                      <span style={{ fontWeight: 700 }}>{s.name}</span>
                      <span className="micro">{s.code} · {s.isActive ? 'ACTIVE' : 'OFF'}</span>
                    </div>
                  </td>
                  <td className="mono fs-12 text-green">{s.startTime}</td>
                  <td className="mono fs-12 text-mid">{s.endTime}</td>
                  <td className="mono fs-12">{s.gracePeriodMinutes}m</td>
                  <td className="mono fs-12">{s.lateThresholdMinutes}m</td>
                  <td className="mono fs-13" style={{ fontWeight: 700 }}>{s.employeeCount}</td>
                  <td><span className="badge badge-green">{s.present}</span></td>
                  <td><span className="badge badge-red">{s.late}</span></td>
                  <td><span className="badge badge-gray">{s.absent}</span></td>
                  <td><span className="badge badge-cyan">{s.onBreak}</span></td>
                  <td><span className="badge badge-gray">{s.signedOut}</span></td>
                  <td><span className="badge badge-violet">{s.gpsIssues}</span></td>
                  <td>
                    <div className="row" style={{ gap: 7 }}>
                      <div style={{ width: 60, height: 7, background: 'var(--bg-elevated)', borderRadius: 4 }}>
                        <div style={{ width: `${s.completionPct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
                      </div>
                      <span className="mono fs-11">{s.completionPct}%</span>
                    </div>
                  </td>
                  <td><button className="btn btn-sm" onClick={() => setSelected(selected === s._id ? null : s._id)}>{selected === s._id ? 'CLOSE' : 'OPEN'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {selectedShift && (
        <Panel
          accentTop
          title={`${selectedShift.name} — Shift Detail`}
          actions={
            <div className="row wrap" style={{ gap: 6 }}>
              <span className="chip chip-green">{selectedShift.startTime} → {selectedShift.endTime}</span>
              <span className="chip">GRACE {selectedShift.gracePeriodMinutes}m</span>
              <span className="chip">LATE &gt;{selectedShift.lateThresholdMinutes}m</span>
              <span className="chip">LUNCH {selectedShift.lunchAllowed}m</span>
              <span className="chip">TEA {selectedShift.teaAllowed}m</span>
              <span className="chip">GPS ≤{selectedShift.gpsPolicy?.requireAccuracy}m ACC</span>
            </div>
          }
          bodyClass=""
        >
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', padding: 12 }}>
            {selectedShift.employees.map((e: any, i: number) => (
              <div key={i} className="event-card" style={{ border: '1px solid var(--line-soft)', borderRadius: 10 }}>
                <Avatar photo={e.employee.photo} name={e.employee.fullName} size="lg" />
                <div className="grow col" style={{ gap: 3 }}>
                  <div className="row-between">
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{e.employee.fullName}</span>
                    <StateBadge state={e.state} />
                  </div>
                  <span className="micro">{e.employee.employeeId} · {e.employee.flow}</span>
                  <div className="fs-12 mono text-mid">
                    Sched {e.employee.shiftTime?.split('–')[0]} → Act {e.actualLogin ? formatTime(e.actualLogin) : '—'}
                    {e.lateMinutes > 0 && <span className="text-red"> +{minutesToLabel(e.lateMinutes)}</span>}
                  </div>
                  <div className="row" style={{ gap: 5 }}>
                    <GpsChip status={e.gpsStatus} />
                    {e.lastEvent && <span className="micro">{e.lastEvent.name.replace(/_/g, ' ')}</span>}
                  </div>
                </div>
              </div>
            ))}
            {selectedShift.employees.length === 0 && <EmptyState title="No personnel on this shift" />}
          </div>
        </Panel>
      )}
    </div>
  );
}
