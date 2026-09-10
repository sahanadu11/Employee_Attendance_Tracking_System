import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiCrosshair, FiMapPin } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, GpsChip, Avatar, Loading, ErrorState, EmptyState, formatTime, EmployeeCell } from '../../components/ui';
import { EmployeeTimelineModal } from '../../components/EmployeeTimelineModal';

export default function GpsDashboard() {
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<any>(null);

  const gpsQ = useQuery({ queryKey: ['dash-gps'], queryFn: dashboardAPI.gps, refetchInterval: 30_000 });
  const data = gpsQ.data?.data;
  const markers = data?.markers || [];

  const filtered = markers.filter((m: any) => {
    if (filter === 'ALL') return true;
    if (filter === 'INSIDE') return m.inside === true;
    if (filter === 'OUTSIDE') return m.inside === false;
    if (filter === 'GPS_ERROR') return (m.location?.accuracy ?? 0) > 100 || !m.location;
    return true;
  });

  if (gpsQ.isLoading) return <Loading label="Triangulating field positions…" />;
  if (gpsQ.isError) return <ErrorState message={String(gpsQ.error)} onRetry={() => gpsQ.refetch()} />;

  const counts = data?.statusCounts || {};

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Inside Perimeter" value={counts.inside ?? 0} tone="green" onClick={() => setFilter('INSIDE')} />
        <KpiCard label="Outside Ring" value={counts.outside ?? 0} tone="red" onClick={() => setFilter('OUTSIDE')} />
        <KpiCard label="Poor Accuracy" value={counts.inaccurate ?? 0} tone="amber" sub=">100m reported error" />
        <KpiCard label="No Signal" value={counts.unavailable ?? 0} tone="violet" sub="permission denied / unavailable" onClick={() => setFilter('GPS_ERROR')} />
      </div>

      <div className="grid grid-23">
        <Panel
          title="Live Position Field"
          icon={<FiCrosshair size={15} className="text-green" />}
          actions={
            <div className="row" style={{ gap: 6 }}>
              {['ALL', 'INSIDE', 'OUTSIDE', 'GPS_ERROR'].map((f) => (
                <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : ''}`} onClick={() => setFilter(f)}>{f.replace('_', ' ')}</button>
              ))}
            </div>
          }
        >
          <div className="radar-wrap" style={{ background: 'var(--bg-void)', border: '1px solid var(--line-soft)', borderRadius: 10, maxHeight: 460 }}>
            <div className="radar-sweep" />
            <div className="radar-cross-h" /><div className="radar-cross-v" />
            <div className="radar-ring" style={{ inset: '14%' }} />
            <div className="radar-ring" style={{ inset: '30%' }} />
            <div className="radar-ring" style={{ inset: '46%' }} />
            {/* HQ */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 16px var(--accent)', margin: '0 auto' }} />
              <span className="micro" style={{ display: 'block', marginTop: 6, background: 'var(--bg-panel)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--line)' }}>{data?.office?.name || 'HQ'}</span>
            </div>
            {filtered.map((m: any, i: number) => {
              const inside = m.inside === true;
              const angle = (i * 137.5) % 360;
              const rad = (angle * Math.PI) / 180;
              const jitter = ((m.location?.accuracy ?? 5) % 10) / 100;
              const r = inside ? 0.16 + jitter : 0.44 + jitter * 2;
              const x = 50 + Math.cos(rad) * r * 100;
              const y = 50 + Math.sin(rad) * r * 100;
              return (
                <div
                  key={m.employeeDbId}
                  className="pointer"
                  title={`${m.fullName} · ±${Math.round(m.location?.accuracy ?? 0)}m · ${m.distanceFromOffice ?? '?'}m from HQ`}
                  onClick={() => setSelected(m)}
                  style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', textAlign: 'center' }}
                >
                  <div style={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: inside ? 'var(--green)' : 'var(--red)',
                    boxShadow: `0 0 10px ${inside ? 'var(--green)' : 'var(--red)'}`,
                    border: (m.location?.accuracy ?? 0) > 100 ? '2px dashed var(--amber)' : 'none',
                  }} />
                  <span className="micro" style={{ display: 'block', marginTop: 2, fontSize: 8 }}>{m.fullName.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
          <div className="row wrap mt-12" style={{ gap: 12 }}>
            <span className="micro row" style={{ gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} /> INSIDE {counts.inside ?? 0}</span>
            <span className="micro row" style={{ gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} /> OUTSIDE {counts.outside ?? 0}</span>
            <span className="micro row" style={{ gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px dashed var(--amber)', display: 'inline-block' }} /> INACCURATE {counts.inaccurate ?? 0}</span>
            <span className="micro">CENTER: {data?.office?.latitude?.toFixed(4)}° N, {data?.office?.longitude?.toFixed(4)}° E · RING {data?.office?.geofenceRadius}m</span>
          </div>
        </Panel>

        <Panel title="Latest Position Updates" icon={<FiMapPin size={14} />} bodyClass="">
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {filtered.length === 0 && <EmptyState title="No live positions" hint="Employees appear once their device reports a location fix." />}
            {filtered.map((m: any) => (
              <div key={m.employeeDbId} className="event-card pointer" onClick={() => setSelected(m)}>
                <Avatar photo={m.photo} name={m.fullName} size="md" />
                <div className="grow col" style={{ gap: 2 }}>
                  <div className="row-between">
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{m.fullName}</span>
                    <span className="micro">{m.employeeId}</span>
                  </div>
                  <div className="fs-12 text-mid">{m.section} · {m.flow}</div>
                  <div className="row wrap" style={{ gap: 5 }}>
                    <GpsChip status={m.inside === true ? 'INSIDE' : m.inside === false ? 'OUTSIDE' : 'UNAVAILABLE'} accuracy={m.location?.accuracy} />
                    <span className="micro">{formatTime(m.location?.timestamp)}</span>
                  </div>
                  {m.lastEvent && <div className="micro">{m.lastEvent.name} · {formatTime(m.lastEvent.time)}</div>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {selected && <EmployeeTimelineModal employee={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
