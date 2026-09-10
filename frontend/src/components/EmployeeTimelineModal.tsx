import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiX } from 'react-icons/fi';
import { employeeAPI } from '../api';
import { StatusBadge, GpsChip, Avatar, Loading, EmptyState, formatTime, formatDateTime } from './ui';

export function EmployeeTimelineModal({ employee, onClose }: { employee: any; onClose: () => void }) {
  const id = employee._id || employee.employeeDbId;
  const timelineQ = useQuery({
    queryKey: ['employee-timeline', id],
    queryFn: () => employeeAPI.getTimeline(id, { limit: 50 }),
    enabled: !!id,
  });

  const events = timelineQ.data?.data?.events || [];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,10,0.78)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div className="panel" style={{ width: 'min(680px, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div className="row" style={{ gap: 12 }}>
            <Avatar photo={employee.photo} name={employee.fullName} size="md" />
            <div className="col" style={{ gap: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{employee.fullName}</span>
              <span className="micro">{employee.employeeId || employee.employeeCode} · {employee.flow} · {employee.shift}</span>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><FiX size={14} /></button>
        </div>
        <div className="scroll-y" style={{ padding: 16, flex: 1 }}>
          {timelineQ.isLoading ? (
            <Loading label="Retrieving event history…" />
          ) : events.length === 0 ? (
            <EmptyState title="No attendance events" hint="This employee has no recorded events for the selected period." />
          ) : (
            <div className="timeline">
              {events.map((ev: any, i: number) => {
                const type = ev.eventTypeId?.eventType || ev.eventTypeId?.code;
                const toneClass = ['LATE', 'GRACE_PERIOD'].includes(ev.status) ? 'late' : ['BLOCKED', 'GPS_FAILURE', 'INVALID', 'SECURITY_LOCK'].includes(ev.status) ? 'bad' : 'done';
                return (
                  <div key={ev._id || i} className={`timeline-item ${toneClass}`}>
                    <div className="row-between wrap" style={{ gap: 8 }}>
                      <div className="row" style={{ gap: 8 }}>
                        {ev.photoUrl && <Avatar photo={ev.photoUrl} name={ev.employeeId?.fullName || 'E'} size="xs" />}
                        <div className="col" style={{ gap: 1 }}>
                          <span className="fs-13" style={{ fontWeight: 600 }}>{ev.eventTypeId?.name || type}</span>
                          <span className="micro">
                            Sched {formatTime(ev.scheduledTime)} → Act {formatTime(ev.actualTime)}
                            {ev.lateDurationMinutes ? ` · +${ev.lateDurationMinutes}m` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <StatusBadge value={ev.status} />
                        <GpsChip status={ev.gpsStatus} accuracy={ev.gpsAccuracy} />
                        {ev.faceVerificationResult && ev.faceVerificationResult !== 'NOT_REQUIRED' && (
                          <StatusBadge value={ev.faceVerificationResult} />
                        )}
                      </div>
                    </div>
                    {ev.notes && <div className="fs-12 text-mid mt-8">“{ev.notes}”</div>}
                    {ev.isAdminOverride && (
                      <div className="badge badge-violet mt-8">ADMIN OVERRIDE{ev.overrideReason ? ` — ${ev.overrideReason}` : ''}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--line-soft)' }}>
          <span className="micro">{events.length} events · most recent first</span>
          <span className="micro">{formatDateTime(new Date())}</span>
        </div>
      </div>
    </div>
  );
}
