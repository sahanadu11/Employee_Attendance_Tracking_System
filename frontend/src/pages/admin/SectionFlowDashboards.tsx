import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiLayers, FiGitBranch } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, StateBadge, GpsChip, Avatar, Loading, ErrorState, EmptyState, Pipeline, minutesToLabel, formatTime } from '../../components/ui';

/* ============ SECTION DASHBOARD ============ */

export function SectionsDashboard() {
  const sectionsQ = useQuery({ queryKey: ['dash-sections'], queryFn: dashboardAPI.sections, refetchInterval: 60_000 });
  const [selected, setSelected] = useState<string | null>(null);
  const data = sectionsQ.data?.data;

  if (sectionsQ.isLoading) return <Loading label="Resolving section topology…" />;
  if (sectionsQ.isError) return <ErrorState message={String(sectionsQ.error)} onRetry={() => sectionsQ.refetch()} />;

  const totals = (data || []).reduce(
    (acc: any, s: any) => ({
      employees: acc.employees + s.employeeCount,
      present: acc.present + s.present,
      late: acc.late + s.late,
      absent: acc.absent + s.absent,
      outside: acc.outside + s.outside,
    }),
    { employees: 0, present: 0, late: 0, absent: 0, outside: 0 }
  );

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Sections" value={data?.length ?? 0} tone="blue" icon={<FiLayers size={15} />} />
        <KpiCard label="Personnel" value={totals.employees} tone="cyan" />
        <KpiCard label="Present" value={totals.present} tone="green" />
        <KpiCard label="Late" value={totals.late} tone="red" />
        <KpiCard label="Absent" value={totals.absent} tone="amber" />
        <KpiCard label="Outside" value={totals.outside} tone="violet" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
        {(data || []).map((s: any) => (
          <Panel
            key={s._id}
            title={s.name}
            actions={<span className="chip">{s.code}</span>}
            accentTop={selected === s._id}
          >
            <div className="col" style={{ gap: 10 }}>
              <div className="row wrap" style={{ gap: 5 }}>
                {s.admins.map((a: any) => <span key={a.email} className="badge badge-blue">{a.email.split('@')[0]}</span>)}
                {s.admins.length === 0 && <span className="badge badge-gray">NO ADMIN ASSIGNED</span>}
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <MiniStat label="Employees" value={s.employeeCount} tone="var(--accent)" />
                <MiniStat label="Flows" value={s.flowCount} tone="var(--cyan)" />
                <MiniStat label="Present" value={s.present} tone="var(--green)" />
                <MiniStat label="Late" value={s.late} tone="var(--red)" />
                <MiniStat label="Absent" value={s.absent} tone="var(--amber)" />
                <MiniStat label="GPS Issues" value={s.gpsIssues} tone="var(--violet)" />
              </div>
              <div>
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <span className="micro">ATTENDANCE COMPLETION</span>
                  <span className="mono fs-12 text-green">{s.completionPct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 5 }}>
                  <div style={{ width: `${s.completionPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--green), var(--accent))', borderRadius: 5 }} />
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 10px' }}>
      <div className="micro">{label}</div>
      <div style={{ color: tone, fontWeight: 800, fontSize: 18 }}>{value}</div>
    </div>
  );
}

/* ============ FLOW DASHBOARD (six-flow overview + detail) ============ */

export function FlowsDashboard() {
  const flowsQ = useQuery({ queryKey: ['dash-flows'], queryFn: dashboardAPI.flows, refetchInterval: 30_000 });
  const [selected, setSelected] = useState<string | null>(null);
  const data = flowsQ.data?.data;

  if (flowsQ.isLoading) return <Loading label="Mapping flow lattice…" />;
  if (flowsQ.isError) return <ErrorState message={String(flowsQ.error)} onRetry={() => flowsQ.refetch()} />;

  const flows = data || [];
  const selectedFlow = flows.find((f: any) => f._id === selected);

  return (
    <div className="col" style={{ gap: 14 }}>
      {/* Overview table — all flows side by side */}
      <Panel
        title="Flow Lattice — All Flows Overview"
        icon={<FiGitBranch size={15} className="text-cyan" />}
        actions={<span className="micro">{flows.length} FLOWS CONFIGURED</span>}
        bodyClass=""
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Flow</th><th>Section</th><th>Shift</th><th>Employees</th><th>Present</th><th>Late</th><th>Absent</th><th>Break</th><th>Outside</th><th>GPS Issue</th><th>Completion</th><th></th></tr>
            </thead>
            <tbody>
              {flows.map((f: any) => (
                <tr key={f._id} className={selected === f._id ? 'row-active' : ''}>
                  <td>
                    <div className="col" style={{ gap: 1 }}>
                      <span style={{ fontWeight: 700 }}>{f.name}</span>
                      <span className="micro">{f.code}</span>
                    </div>
                  </td>
                  <td className="fs-12">{f.section}</td>
                  <td className="fs-12 text-mid">{f.shifts?.[0]?.name || '—'}</td>
                  <td className="mono fs-13" style={{ fontWeight: 700 }}>{f.employeeCount}</td>
                  <td><span className="badge badge-green">{f.present}</span></td>
                  <td><span className="badge badge-red">{f.late}</span></td>
                  <td><span className="badge badge-gray">{f.absent}</span></td>
                  <td><span className="badge badge-cyan">{f.onBreak}</span></td>
                  <td><span className="badge badge-violet">{f.outside}</span></td>
                  <td><span className="badge badge-amber">{f.gpsIssues}</span></td>
                  <td>
                    <div className="row" style={{ gap: 7 }}>
                      <div style={{ width: 64, height: 7, background: 'var(--bg-elevated)', borderRadius: 4 }}>
                        <div style={{ width: `${f.completionPct}%`, height: '100%', background: 'var(--green)', borderRadius: 4 }} />
                      </div>
                      <span className="mono fs-11">{f.completionPct}%</span>
                    </div>
                  </td>
                  <td><button className="btn btn-sm" onClick={() => setSelected(selected === f._id ? null : f._id)}>{selected === f._id ? 'CLOSE' : 'OPEN'}</button></td>
                </tr>
              ))}
              {flows.length === 0 && <tr><td colSpan={12}><EmptyState title="No flows configured" /></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Flow detail */}
      {selectedFlow && (
        <Panel
          accentTop
          title={`${selectedFlow.name} — Live Roster`}
          actions={
            <div className="row wrap" style={{ gap: 6 }}>
              <span className="chip">{selectedFlow.section}</span>
              <span className={`badge ${selectedFlow.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>{selectedFlow.status}</span>
              {selectedFlow.shifts?.map((s: any) => <span key={s._id} className="chip chip-blue">{s.name} {s.startTime}–{s.endTime}</span>)}
            </div>
          }
          bodyClass=""
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-soft)' }}>
            <span className="micro">ATTENDANCE SEQUENCE</span>
            <div className="mt-8">
              <Pipeline
                steps={(selectedFlow.attendanceSequence || []).map((code: string, i: number) => ({
                  code,
                  label: `${i + 1}.${code.replace(/_/g, ' ')}`,
                  status: 'upcoming' as const,
                }))}
              />
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', padding: 12 }}>
            {selectedFlow.employees.map((e: any) => (
              <div key={e.employee._id} className="event-card" style={{ border: '1px solid var(--line-soft)', borderRadius: 10 }}>
                <Avatar photo={e.employee.photo} name={e.employee.fullName} size="lg" />
                <div className="grow col" style={{ gap: 3 }}>
                  <div className="row-between">
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{e.employee.fullName}</span>
                    <StateBadge state={e.state} />
                  </div>
                  <span className="micro">{e.employee.employeeId} · {e.employee.shift}</span>
                  <div className="fs-12 text-mid">
                    {e.lastEvent ? `${e.lastEvent.name.replace(/_/g, ' ')} · ${formatTime(e.lastEvent.time)}` : 'No events yet'}
                  </div>
                  {e.lateMinutes > 0 && <span className="badge badge-red" style={{ alignSelf: 'flex-start' }}>LATE {minutesToLabel(e.lateMinutes)}</span>}
                  <GpsChip status={e.gpsStatus} />
                </div>
              </div>
            ))}
            {selectedFlow.employees.length === 0 && <EmptyState title="No personnel assigned to this flow" />}
          </div>
        </Panel>
      )}
    </div>
  );
}
