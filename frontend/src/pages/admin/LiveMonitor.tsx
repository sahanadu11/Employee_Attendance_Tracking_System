import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiDownload, FiRadio } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { useRealtime, mergeLiveEvents, LiveAttendanceEvent } from '../../services/realtime';
import { Panel, StatusBadge, Avatar, GpsChip, Loading, ErrorState, EmptyState, exportCsv, formatTime, useFreshEvents } from '../../components/ui';

export default function LiveMonitor() {
  const { liveEvents: socketEvents, connected } = useRealtime();
  const [status, setStatus] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');
  const [flow, setFlow] = useState('');

  const params: any = { limit: 50 };
  if (status) params.status = status;
  if (gpsStatus) params.gpsStatus = gpsStatus;

  const realtimeQ = useQuery({
    queryKey: ['dash-realtime', status, gpsStatus],
    queryFn: () => dashboardAPI.realtime(params),
    refetchInterval: 15_000,
  });
  const flowsQ = useQuery({ queryKey: ['flows-list'], queryFn: () => dashboardAPI.flows(), staleTime: 300_000 });

  const httpEvents: LiveAttendanceEvent[] = realtimeQ.data?.data || [];
  const events = useMemo(() => mergeLiveEvents<LiveAttendanceEvent>(httpEvents, socketEvents, 60), [httpEvents, socketEvents]);
  const fresh = useFreshEvents(events as any, 120_000);

  const filtered = flow ? events.filter((e: any) => e.flow === flow) : events;

  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel
        accentTop
        title="Live Attendance Monitor — Realtime Event Wall"
        icon={<span className="live-dot green" />}
        actions={
          <div className="row wrap" style={{ gap: 8 }}>
            <span className={`chip ${connected ? 'chip-green' : 'chip-red'}`}>● {connected ? 'RA STREAMING' : 'POLLING'}</span>
            <select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['ON_TIME', 'EARLY', 'GRACE_PERIOD', 'LATE', 'BLOCKED', 'GPS_FAILURE', 'INVALID'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select className="select" style={{ width: 150 }} value={gpsStatus} onChange={(e) => setGpsStatus(e.target.value)}>
              <option value="">All GPS</option>
              {['INSIDE', 'OUTSIDE', 'INACCURATE', 'UNAVAILABLE', 'PERMISSION_DENIED'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select className="select" style={{ width: 150 }} value={flow} onChange={(e) => setFlow(e.target.value)}>
              <option value="">All flows</option>
              {(flowsQ.data?.data || []).map((f: any) => (
                <option key={f._id} value={f.name}>{f.name}</option>
              ))}
            </select>
            <button className="btn btn-sm" onClick={() => exportCsv('live-monitor.csv', filtered.map((e: any) => ({
              employee: e.employeeName, code: e.employeeCode, section: e.section, flow: e.flow, shift: e.shift, event: e.event, status: e.status, lateMinutes: e.lateDurationMinutes || 0, gps: e.gpsStatus, accuracy: e.gpsAccuracy || '', time: formatTime(e.actualTime),
            })))}>
              <FiDownload size={11} /> CSV
            </button>
          </div>
        }
        bodyClass=""
      >
        {realtimeQ.isLoading ? (
          <Loading label="Streaming events…" />
        ) : realtimeQ.isError ? (
          <ErrorState message={String(realtimeQ.error)} onRetry={() => realtimeQ.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FiRadio size={26} /> as any} title="Event wall clear" hint="New attendance events stream in here instantly — no refresh needed." />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', padding: 12 }}>
            {filtered.map((e: any, i: number) => {
              const isFresh = fresh.has(e._id) && i < 8;
              return (
                <div key={e._id || i} className={`event-card ${isFresh ? 'fresh' : ''} ${['LATE', 'BLOCKED', 'GPS_FAILURE'].includes(e.status) ? 'alert' : ''}`} style={{ border: '1px solid var(--line-soft)', borderRadius: 10 }}>
                  <Avatar photo={e.employeePhoto} name={e.employeeName} size="lg" />
                  <div className="grow col" style={{ gap: 4 }}>
                    <div className="row-between">
                      <span style={{ fontWeight: 700 }}>{e.employeeName}</span>
                      <span className="micro">{e.employeeCode}</span>
                    </div>
                    <div className="fs-12 text-mid">{e.section} · {e.flow}</div>
                    <div className="fs-12 text-mid">{e.shift} · Sched {formatTime(e.scheduledTime)}</div>
                    <div className="row wrap" style={{ gap: 5 }}>
                      <span className="badge badge-blue">{e.event}</span>
                      <StatusBadge value={e.status} />
                      {e.lateDurationMinutes ? <span className="badge badge-red">+{e.lateDurationMinutes}m</span> : null}
                    </div>
                    <div className="row wrap" style={{ gap: 5 }}>
                      <GpsChip status={e.gpsStatus} accuracy={e.gpsAccuracy} />
                      <span className="micro">{formatTime(e.actualTime)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
