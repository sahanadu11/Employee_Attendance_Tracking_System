import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiMapPin, FiClock, FiWifi } from 'react-icons/fi';
import { attendanceAPI, gpsAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Panel, Avatar, StatusBadge, GpsChip, Pipeline, Loading, ErrorState, EmptyState, formatTime, minutesToLabel } from '../../components/ui';
import { useRealtime } from '../../services/realtime';

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const { lastEvent } = useRealtime();

  const meQ = useQuery({ queryKey: ['me'], queryFn: gpsAPI.getMe, staleTime: 60_000 });
  const historyQ = useQuery({ queryKey: ['my-attendance'], queryFn: () => attendanceAPI.history({ limit: 12 }), refetchInterval: 30_000 });

  const me = meQ.data?.data;
  const events = historyQ.data?.data?.events || [];

  const eventType = (ev: any) => ev.eventTypeId?.eventType || ev.eventTypeId?.code;
  const login = events.find((e: any) => ['LOGIN', 'MORNING_IN'].includes(eventType(e)));
  const signOut = [...events].reverse().find((e: any) => eventType(e) === 'SIGN_OUT');
  const last = events[0];

  let state = 'NOT_STARTED';
  if (last) {
    const t = eventType(last);
    if (t === 'SIGN_OUT') state = 'SIGNED_OUT';
    else if (t === 'LUNCH_OUT') state = 'ON_LUNCH';
    else if (t === 'TEA_OUT') state = 'ON_TEA';
    else state = 'WORKING';
  }

  const pipelineSteps = [
    { code: 'LOGIN', label: '1.LOGIN', status: login ? 'done' : 'current', time: login ? formatTime(login.actualTime) : undefined },
    { code: 'LUNCH_OUT', label: '2.LUNCH OUT', status: events.some((e: any) => eventType(e) === 'LUNCH_OUT') ? 'done' : login ? 'current' : 'upcoming' },
    { code: 'LUNCH_IN', label: '3.LUNCH IN', status: events.some((e: any) => eventType(e) === 'LUNCH_IN') ? 'done' : 'upcoming' },
    { code: 'TEA_OUT', label: '4.TEA OUT', status: events.some((e: any) => eventType(e) === 'TEA_OUT') ? 'done' : 'upcoming' },
    { code: 'TEA_IN', label: '5.TEA IN', status: events.some((e: any) => eventType(e) === 'TEA_IN') ? 'done' : 'upcoming' },
    { code: 'SIGN_OUT', label: '6.SIGN OUT', status: signOut ? 'done' : 'upcoming' },
  ] as any;

  if (meQ.isLoading) return <Loading label="Linking field unit…" />;
  if (meQ.isError) return <ErrorState message={String(meQ.error)} onRetry={() => meQ.refetch()} />;

  return (
    <div className="col" style={{ gap: 14 }}>
      {/* Hero */}
      <div className="emp-hero">
        <Avatar photo={me?.photo} name={me?.fullName || user?.email || 'E'} size="xl" />
        <div className="grow col" style={{ gap: 5 }}>
          <div className="row wrap" style={{ gap: 7 }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{me?.fullName || 'Field Unit'}</span>
            {me?.employeeId && <span className="chip chip-blue">{me.employeeId}</span>}
          </div>
          <div className="fs-12 text-mid">
            {me?.sectionId?.name || '—'} · {me?.flowId?.name || '—'} · {me?.shiftId?.name || '—'}
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {me?.shiftId && <span className="chip">SHIFT {me.shiftId.startTime}–{me.shiftId.endTime}</span>}
            <GpsChip status={last?.gpsStatus} accuracy={last?.gpsAccuracy} />
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className={`badge ${state === 'WORKING' ? 'badge-green' : state === 'ON_LUNCH' || state === 'ON_TEA' ? 'badge-cyan' : state === 'SIGNED_OUT' ? 'badge-gray' : 'badge-blue'}`}>
              {state.replace(/_/g, ' ')}
            </span>
            {login?.status === 'LATE' && login.lateDurationMinutes ? (
              <span className="badge badge-red">LATE {minutesToLabel(login.lateDurationMinutes)}</span>
            ) : login ? (
              <span className="badge badge-green">{login.status.replace(/_/g, ' ')}</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Next action */}
      <Panel accentTop title="Next Expected Event">
        <div className="row-between">
          <div className="col" style={{ gap: 2 }}>
            <span className="micro">CURRENT STATE</span>
            <span className="fs-13" style={{ fontWeight: 700 }}>{state.replace(/_/g, ' ')}</span>
          </div>
          <div className="col" style={{ gap: 2, textAlign: 'right' }}>
            <span className="micro">LAST EVENT</span>
            <span className="fs-13 mono">{last ? `${last.eventTypeId?.name} · ${formatTime(last.actualTime)}` : 'Awaiting first check-in'}</span>
          </div>
        </div>
        <div className="mt-12">
          <Pipeline steps={pipelineSteps} />
        </div>
      </Panel>

      {/* Today timeline */}
      <Panel title="Today's Timeline" bodyClass="">
        {historyQ.isLoading ? (
          <Loading label="Loading your day…" />
        ) : events.length === 0 ? (
          <EmptyState title="No events yet today" hint="Your first check-in will appear here." />
        ) : (
          <div style={{ padding: 14 }}>
            <div className="timeline">
              {events.map((ev: any, i: number) => {
                const toneClass = ['LATE', 'GRACE_PERIOD'].includes(ev.status) ? 'late' : ['BLOCKED', 'GPS_FAILURE', 'INVALID'].includes(ev.status) ? 'bad' : 'done';
                return (
                  <div key={ev._id || i} className={`timeline-item ${toneClass}`}>
                    <div className="row-between wrap" style={{ gap: 6 }}>
                      <div>
                        <span className="fs-13" style={{ fontWeight: 600 }}>{ev.eventTypeId?.name}</span>
                        <div className="micro">Sched {formatTime(ev.scheduledTime)} → Act {formatTime(ev.actualTime)}</div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <StatusBadge value={ev.status} />
                        <GpsChip status={ev.gpsStatus} accuracy={ev.gpsAccuracy} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      {lastEvent && (
        <Panel title="Live Sync">
          <div className="row" style={{ gap: 10 }}>
            <FiWifi size={16} className="text-green" />
            <span className="fs-12 text-mid">Realtime link active — your attendance events reach supervisors instantly.</span>
          </div>
        </Panel>
      )}
    </div>
  );
}
