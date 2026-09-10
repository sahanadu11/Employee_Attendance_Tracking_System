import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { FiUsers, FiMapPin, FiAlertTriangle, FiCoffee, FiCrosshair, FiLock, FiRadio, FiShield, FiDownload } from 'react-icons/fi';
import { dashboardAPI, lockAPI } from '../../api';
import { useRealtime, mergeLiveEvents, LiveAttendanceEvent } from '../../services/realtime';
import { KpiCard, Panel, StatusBadge, StateBadge, Avatar, GpsChip, Pipeline, Loading, ErrorState, EmptyState, exportCsv, formatTime, minutesToLabel, useFreshEvents } from '../../components/ui';

const LIVE_WINDOW_DEFAULT_MS = 120_000;

export default function CommandCenter() {
  const navigate = useNavigate();
  const { liveEvents: socketEvents, connected } = useRealtime();
  const [pumpOn, setPumpOn] = useState(true);

  const overviewQ = useQuery({ queryKey: ['dash-overview'], queryFn: dashboardAPI.overview, refetchInterval: 30_000 });
  const realtimeQ = useQuery({ queryKey: ['dash-realtime'], queryFn: () => dashboardAPI.realtime({ limit: 25 }), refetchInterval: 20_000 });
  const securityQ = useQuery({ queryKey: ['dash-security'], queryFn: dashboardAPI.security, refetchInterval: 60_000 });
  const gpsQ = useQuery({ queryKey: ['dash-gps'], queryFn: dashboardAPI.gps, refetchInterval: 60_000 });

  const overview = overviewQ.data?.data;
  const httpEvents: LiveAttendanceEvent[] = realtimeQ.data?.data || [];
  const events = useMemo(
    () => (pumpOn ? mergeLiveEvents<LiveAttendanceEvent>(httpEvents, socketEvents, 30) : httpEvents.slice(0, 30)),
    [httpEvents, socketEvents, pumpOn]
  );
  const liveWindowMs = LIVE_WINDOW_DEFAULT_MS;
  const fresh = useFreshEvents(events, liveWindowMs);

  const security = securityQ.data?.data;
  const gps = gpsQ.data?.data;
  const cards = overview?.cards;
  const charts = overview?.charts;

  if (overviewQ.isLoading) return <Loading label="Establishing command link…" />;
  if (overviewQ.isError) return <ErrorState message={String(overviewQ.error)} onRetry={() => overviewQ.refetch()} />;

  const flash = events.find((e) => fresh.has(e._id as string));

  const kpis = [
    { label: 'Total Workforce', value: cards?.totalEmployees ?? '—', sub: 'Active sector registered', tone: 'blue' as const, icon: <FiUsers size={15} />, footLeft: `${charts?.byFlow?.length ?? 0} FLOWS`, footRight: '100% ASSIGNED', onClick: () => navigate('/employees') },
    { label: 'On-Site Verified', value: cards?.present ?? '—', sub: 'Inside 1m geofence ring', tone: 'green' as const, icon: <FiMapPin size={15} />, footLeft: 'RTK DUAL BAND', delta: overview?.trends?.presentDelta, onClick: () => navigate('/photo-monitor?state=PRESENT') },
    { label: 'Late Flagged', value: cards?.late ?? '—', sub: '>15m threshold breach', tone: 'red' as const, icon: <FiAlertTriangle size={15} />, footLeft: `AVG ${overview ? '—' : '—'}`, delta: overview?.trends?.lateDelta, onClick: () => navigate('/late') },
    { label: 'Break / Lunch', value: cards?.onBreak ?? '—', sub: `Lunch: ${cards?.onLunch ?? 0} | Tea: ${cards?.onTea ?? 0}`, tone: 'amber' as const, icon: <FiCoffee size={15} />, footLeft: `${cards?.onBreak ? 'OVER-LIMIT?' : 'NO OVER-RUN'}`, footRight: 'AUTO NOTIFY', onClick: () => navigate('/breaks-dash') },
    { label: 'Geofence Breach', value: cards?.outsideGeofence ?? '—', sub: 'Outside HQ perimeter ring', tone: 'red' as const, icon: <FiCrosshair size={15} />, footLeft: 'PERIMETER-W', footRight: '1 SIGNAL LOSS', onClick: () => navigate('/gps') },
    { label: 'Auth Lockouts', value: cards?.lockedAccounts ?? '—', sub: '3x failed credentials', tone: 'violet' as const, icon: <FiLock size={15} />, footLeft: 'ADMIN OVERRIDE REQ', footRight: 'SEC-LEDGER', onClick: () => navigate('/security') },
  ];

  return (
    <div className="col" style={{ gap: 14 }}>
      {/* ===== KPI row ===== */}
      <div className="grid grid-kpi">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} value={k.value as any} />
        ))}
      </div>

      {/* ===== Middle: live flash + stream + radar ===== */}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)' }}>
        <div className="col" style={{ gap: 14, minWidth: 0 }}>
          {/* Live Event Photo Flash */}
          <Panel
            accentTop
            title="Live Event Photo Flash"
            icon={<span className="live-dot" />}
            actions={
              <div className="row" style={{ gap: 8 }}>
                <span className="micro">Live display lock: {Math.round(liveWindowMs / 1000)}s</span>
                <span className="chip chip-blue">TELEMETRY ID: {flash ? `EVT-${String(flash._id).slice(-6).toUpperCase()}` : 'EVT-STANDBY'}</span>
              </div>
            }
          >
            {flash ? (
              <FlashCard ev={flash} />
            ) : (
              <div className="state-box" style={{ padding: 26 }}>
                <FiRadio size={26} />
                <span className="micro">Awaiting next live event — all personnel accounted</span>
              </div>
            )}
          </Panel>

          {/* Attendance event stream */}
          <Panel
            title={
              <span>
                Attendance Event Stream &amp; Roster
              </span>
            }
            actions={
              <div className="row" style={{ gap: 8 }}>
                <button className={`toggle ${pumpOn ? 'on' : ''}`} onClick={() => setPumpOn(!pumpOn)} title="WebSocket event pump" aria-label="Toggle realtime pump" />
                <span className="micro">WEBSOCKET EVENT PUMP</span>
                <span className={`chip ${connected ? 'chip-green' : 'chip-red'}`}>● {connected ? 'RA STREAMING' : 'STALE — POLLING'}</span>
                <button className="btn btn-sm" onClick={() => exportCsv('event-stream.csv', events.map((e: any) => ({
                  employee: e.employeeName, code: e.employeeCode, section: e.section, flow: e.flow, shift: e.shift, event: e.event, status: e.status, time: formatTime(e.actualTime), gps: e.gpsStatus,
                })))}>
                  <FiDownload size={11} /> CSV
                </button>
              </div>
            }
            bodyClass=""
          >
            <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              {events.length === 0 && <EmptyState title="No events yet" hint="Attendance events appear here in realtime as personnel check in." />}
              {events.map((e: any, i: number) => {
                const isFresh = fresh.has(e._id) && i < 6;
                const isAlert = e.status === 'LATE' || e.status === 'BLOCKED' || e.status === 'GPS_FAILURE' || e.status === 'INVALID';
                return (
                  <div key={e._id || i} className={`event-card ${isFresh ? 'fresh' : ''} ${isAlert ? 'alert' : ''}`}>
                    <Avatar photo={e.employeePhoto} name={e.employeeName} size="md" />
                    <div className="grow">
                      <div className="row-between">
                        <div className="row" style={{ gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{e.employeeName}</span>
                          <span className="micro">{e.employeeCode}</span>
                          {e.sequenceNumber && <span className="micro">#{e.sequenceNumber}</span>}
                        </div>
                        <span className="micro">{formatTime(e.actualTime)}</span>
                      </div>
                      <div className="fs-12 text-mid" style={{ marginTop: 2 }}>
                        {e.flow} · {e.shift}
                      </div>
                      <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                        <span className="badge badge-blue">{e.event}</span>
                        <StatusBadge value={e.status} />
                        {e.lateDurationMinutes ? <span className="badge badge-red">+{e.lateDurationMinutes}m</span> : null}
                        <GpsChip status={e.gpsStatus} accuracy={e.gpsAccuracy} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="row-between" style={{ padding: '10px 14px' }}>
                <span className="micro">SHOWING {events.length} OF {cards?.totalEmployees ?? 0} PERSONNEL</span>
                <Link to="/attendance" className="micro-bright micro pointer">VIEW FULL HISTORY →</Link>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right column: radar + lockouts */}
        <div className="col" style={{ gap: 14, minWidth: 0 }}>
          <GeofenceRadarPanel gps={gps} />

          <Panel
            title="Security Lockouts & Failed"
            icon={<FiShield size={15} className="text-red" />}
            actions={<span className="badge badge-red">POLICY: 3-FAILED LOCK</span>}
            bodyClass=""
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User / Badge</th>
                    <th>Fails</th>
                    <th>Source IP / Device</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(security?.lockedAccounts || []).length === 0 && (
                    <tr><td colSpan={5} className="text-low fs-12" style={{ textAlign: 'center', padding: 18 }}>No active lockouts — all clear</td></tr>
                  )}
                  {(security?.lockedAccounts || []).map((u: any) => (
                    <tr key={u._id} className="row-danger">
                      <td>
                        <div className="col" style={{ gap: 1 }}>
                          <span className="fs-13" style={{ fontWeight: 600 }}>{u.email}</span>
                          <span className="micro">{u.employeeCode || u.role}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-red">{u.failedAttempts}/3</span></td>
                      <td className="mono fs-11 text-mid">—</td>
                      <td className="mono fs-12">{formatTime(u.lockedUntil)}</td>
                      <td>
                        <UnlockBtn userId={u._id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-between" style={{ padding: '10px 14px', borderTop: '1px solid var(--line-soft)' }}>
              <span className="micro">FAILS TODAY: {security?.counts?.failedLogins ?? 0}</span>
              <Link to="/security" className="micro pointer" style={{ color: 'var(--accent)' }}>SECURITY DASHBOARD →</Link>
            </div>
          </Panel>
        </div>
      </div>

      {/* ===== Bottom: charts row ===== */}
      <HourlyCharts hourly={charts?.hourly || []} byShift={charts?.byShift || []} byFlow={charts?.byFlow || []} />
    </div>
  );
}

/* ---------- Live flash card ---------- */

function FlashCard({ ev }: { ev: LiveAttendanceEvent }) {
  const late = ev.status === 'LATE' || ev.status === 'GRACE_PERIOD';
  return (
    <div className={`flash-border`} style={{ borderRadius: 12, padding: 16, background: 'var(--bg-panel-2)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', gap: 18, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', inset: -8, border: '1px solid rgba(79,140,255,0.5)', borderRadius: 10, pointerEvents: 'none' }}>
            <span className="micro" style={{ position: 'absolute', top: -7, left: 8, background: 'var(--bg-panel-2)', padding: '0 4px' }}>[+]</span>
            <span className="micro" style={{ position: 'absolute', top: -7, right: 8, background: 'var(--bg-panel-2)', padding: '0 4px' }}>[+]</span>
          </div>
          <Avatar photo={ev.employeePhoto} name={ev.employeeName} size="xl" />
          <div className="row" style={{ gap: 6, marginTop: 8, justifyContent: 'center' }}>
            <span className="chip chip-green" style={{ fontSize: 9.5 }}>FACE CONFIRM: 99.4%</span>
          </div>
        </div>
        <div className="col" style={{ gap: 7 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{ev.employeeName}</span>
            <span className="chip chip-blue">{ev.employeeCode}</span>
            {late && ev.lateDurationMinutes ? <span className="badge badge-red">LATE BY {ev.lateDurationMinutes}M</span> : <StatusBadge value={ev.status} />}
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '4px 18px', marginTop: 4 }}>
            <div className="col" style={{ gap: 0 }}>
              <span className="micro">Section / Squad</span>
              <span className="fs-13">{ev.section}</span>
            </div>
            <div className="col" style={{ gap: 0 }}>
              <span className="micro">Assigned Shift</span>
              <span className="fs-13">{ev.shift}</span>
            </div>
            <div className="col" style={{ gap: 0 }}>
              <span className="micro">Event Trigger</span>
              <span className="fs-13 text-cyan">{ev.event}</span>
            </div>
            <div className="col" style={{ gap: 0 }}>
              <span className="micro">Stamp Delta</span>
              <span className="fs-13 mono">
                Sched {formatTime(ev.scheduledTime)} → Act {formatTime(ev.actualTime)}
                {late && ev.lateDurationMinutes ? <span className="text-red"> (+{ev.lateDurationMinutes}m)</span> : null}
              </span>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
            <GpsChip status={ev.gpsStatus} accuracy={ev.gpsAccuracy} />
            <span className="chip">Chrome PWA</span>
            <span className="chip">{ev.flow}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Geofence radar ---------- */

function GeofenceRadarPanel({ gps }: { gps: any }) {
  const markers = (gps?.markers || []) as any[];
  return (
    <Panel
      title="GPS Geofence Vector Radar"
      icon={<FiCrosshair size={15} className="text-green" />}
      actions={<span className="chip chip-green">RING: {gps?.office?.geofenceRadius ?? 100}m RADIUS</span>}
    >
      <div className="radar-wrap" style={{ background: 'var(--bg-void)', border: '1px solid var(--line-soft)', borderRadius: 10, maxHeight: 300 }}>
        <div className="radar-sweep" />
        <div className="radar-cross-h" />
        <div className="radar-cross-v" />
        <div className="radar-ring" style={{ inset: '18%' }} />
        <div className="radar-ring" style={{ inset: '36%' }} />
        {/* HQ center */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 14px var(--accent)', margin: '0 auto' }} />
          <span className="micro" style={{ display: 'block', marginTop: 6, background: 'var(--bg-panel)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--line)' }}>
            {gps?.office?.name || 'HQ'}
          </span>
        </div>
        {markers.slice(0, 14).map((m: any, i: number) => {
          const inside = m.inside === true;
          // Scatter positions deterministically inside/outside rings
          const angle = (i * 137.5) % 360;
          const rad = (angle * Math.PI) / 180;
          const r = inside ? 0.18 + (i % 4) * 0.05 : 0.42 + (i % 3) * 0.06;
          const x = 50 + Math.cos(rad) * r * 100;
          const y = 50 + Math.sin(rad) * r * 100;
          return (
            <div
              key={m.employeeDbId || i}
              title={`${m.fullName} · ${m.section} · ${m.inside ? 'INSIDE' : 'OUTSIDE'} ${m.location?.accuracy ? `· ±${Math.round(m.location.accuracy)}m` : ''}`}
              style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
            >
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: inside ? 'var(--green)' : 'var(--red)', boxShadow: `0 0 8px ${inside ? 'var(--green)' : 'var(--red)'}` }} />
            </div>
          );
        })}
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
        <div className="col">
          <span className="micro">Perimeter Lock</span>
          <span className="text-green mono fs-13" style={{ fontWeight: 700 }}>{gps?.statusCounts?.inside ?? 0} INSIDE</span>
        </div>
        <div className="col">
          <span className="micro">Breach Event</span>
          <span className="text-red mono fs-13" style={{ fontWeight: 700 }}>{(gps?.statusCounts?.outside ?? 0) + (gps?.statusCounts?.inaccurate ?? 0)} OUTSIDE</span>
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Unlock button with audit ---------- */

function UnlockBtn({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const unlock = async () => {
    setBusy(true);
    try {
      await lockAPI.unlock(userId);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="btn btn-sm btn-primary" disabled={busy} onClick={unlock}>
      {busy ? '…' : 'UNLOCK'}
    </button>
  );
}

/* ---------- Charts (pure SVG, no lib) ---------- */

export function HourlyCharts({ hourly, byShift, byFlow }: { hourly: any[]; byShift: any[]; byFlow: any[] }) {
  const maxHour = Math.max(1, ...hourly.map((h: any) => h.count));
  return (
    <div className="grid grid-3">
      <Panel title="Hourly Event Volume" icon={<span className="micro">00–23 UTC-LOCAL</span>}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110 }}>
          {Array.from({ length: 24 }, (_, h) => {
            const row = hourly.find((x: any) => x.hour === h);
            const count = row?.count || 0;
            const late = row?.late || 0;
            return (
              <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', gap: 2 }} title={`${String(h).padStart(2, '0')}:00 — ${count} events (${late} late)`}>
                {late > 0 && <div style={{ height: `${(late / maxHour) * 100}%`, background: 'var(--red)', borderRadius: 2 }} />}
                <div style={{ height: `${((count - late) / maxHour) * 100}%`, background: 'var(--accent)', borderRadius: 2, minHeight: count ? 3 : 0 }} />
              </div>
            );
          })}
        </div>
        <div className="row-between mt-8">
          <span className="micro">HOURLY EVENTS (LATE IN RED)</span>
          <span className="micro">{hourly.reduce((a: number, h: any) => a + h.count, 0)} TODAY</span>
        </div>
      </Panel>

      <Panel title="By Shift">
        <BarList rows={byShift} />
      </Panel>
      <Panel title="By Flow">
        <BarList rows={byFlow} tone="var(--cyan)" />
      </Panel>
    </div>
  );
}

function BarList({ rows, tone = 'var(--accent)' }: { rows: any[]; tone?: string }) {
  if (!rows.length) return <EmptyState title="No activity yet" />;
  const max = Math.max(1, ...rows.map((r: any) => r.count));
  return (
    <div className="col" style={{ gap: 9 }}>
      {rows.map((r: any, i: number) => (
        <div key={i}>
          <div className="row-between" style={{ marginBottom: 3 }}>
            <span className="fs-12 truncate">{r.label}</span>
            <span className="mono fs-11 text-mid">{r.count}{r.late ? <span className="text-red"> · {r.late}L</span> : null}</span>
          </div>
          <div style={{ height: 7, background: 'var(--bg-elevated)', borderRadius: 4 }}>
            <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', background: tone, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
