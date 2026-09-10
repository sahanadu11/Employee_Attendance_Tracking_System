import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiCamera, FiSearch } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, StateBadge, GpsChip, Avatar, Loading, ErrorState, EmptyState, formatTime, minutesToLabel } from '../../components/ui';
import { EmployeeTimelineModal } from '../../components/EmployeeTimelineModal';

const STATES = ['ALL', 'PRESENT', 'LATE', 'ABSENT', 'ON_LUNCH', 'ON_TEA', 'SIGNED_OUT'];

export default function PhotoMonitor() {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('ALL');
  const [selected, setSelected] = useState<any>(null);

  const gridQ = useQuery({
    queryKey: ['dash-employees', search, state],
    queryFn: () => dashboardAPI.employees({ search, state, limit: 60 }),
    refetchInterval: 30_000,
  });

  const data = gridQ.data?.data;
  const counts = data?.counts;

  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel
        title="Employee Photo Monitoring"
        actions={
          <div className="row wrap" style={{ gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <FiSearch size={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-low)' }} />
              <input className="input" placeholder="Search name / ID…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 28, width: 220 }} />
            </div>
          </div>
        }
        bodyClass=""
      >
        <div className="row wrap" style={{ gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--line-soft)' }}>
          {STATES.map((s) => {
            const n = s === 'ALL' ? counts?.total : (counts as any)?.[s.toLowerCase()] ?? 0;
            return (
              <button
                key={s}
                className={`btn btn-sm ${state === s ? 'btn-primary' : ''}`}
                onClick={() => setState(s)}
              >
                {s.replace(/_/g, ' ')} {s !== 'ALL' && <span style={{ opacity: 0.7 }}>{n}</span>}
              </button>
            );
          })}
        </div>

        {gridQ.isLoading ? (
          <Loading label="Loading personnel roster…" />
        ) : gridQ.isError ? (
          <ErrorState message={String(gridQ.error)} onRetry={() => gridQ.refetch()} />
        ) : (data?.cards || []).length === 0 ? (
          <EmptyState icon={<FiCamera size={26} /> as any} title="No personnel match" hint="Adjust search or state filters." />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', padding: 12 }}>
            {data.cards.map((c: any) => (
              <div key={c.employee._id} className="photo-card" onClick={() => setSelected(c.employee)}>
                <div className="photo-wrap">
                  <img src={c.employee.photo || undefined} alt={c.employee.fullName} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  {!c.employee.photo && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: 'var(--text-low)' }}>
                      {c.employee.fullName.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                    </div>
                  )}
                  <span className="state-strip"><StateBadge state={c.state} /></span>
                  <span className="gps-strip">
                    <GpsChip status={c.gpsStatus} />
                  </span>
                </div>
                <div className="col" style={{ padding: '10px 12px', gap: 3 }}>
                  <span className="fs-13" style={{ fontWeight: 700 }}>{c.employee.fullName}</span>
                  <span className="micro">{c.employee.employeeId} · {c.employee.flow}</span>
                  <span className="micro">{c.employee.shift} · {c.employee.shiftTime}</span>
                  <div className="row-between mt-8" style={{ gap: 6 }}>
                    <span className="micro">{c.lastEvent ? c.lastEvent.name.replace(/_/g, ' ') : 'NO EVENT'}</span>
                    <span className="micro-bright micro">{c.lastEvent ? formatTime(c.lastEvent.time) : '—'}</span>
                  </div>
                  {c.lateMinutes > 0 && <span className="badge badge-red" style={{ alignSelf: 'flex-start' }}>LATE {minutesToLabel(c.lateMinutes)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line-soft)' }}>
          <span className="micro">SHOWING {(data?.cards || []).length} OF {data?.total ?? 0}</span>
        </div>
      </Panel>

      {selected && <EmployeeTimelineModal employee={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
