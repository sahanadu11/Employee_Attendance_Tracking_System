import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiCoffee } from 'react-icons/fi';
import { attendanceAPI } from '../../api';
import { Panel, StatusBadge, EmptyState, Loading, formatTime, minutesToLabel } from '../../components/ui';

export default function EmployeeBreaks() {
  const historyQ = useQuery({ queryKey: ['my-attendance'], queryFn: () => attendanceAPI.history({ limit: 30 }), refetchInterval: 30_000 });
  const events = historyQ.data?.data?.events || [];
  const type = (ev: any) => ev.eventTypeId?.eventType || ev.eventTypeId?.code;

  const lunchOut = [...events].reverse().find((e: any) => type(e) === 'LUNCH_OUT');
  const lunchIn = [...events].reverse().find((e: any) => type(e) === 'LUNCH_IN');
  const teaOut = [...events].reverse().find((e: any) => type(e) === 'TEA_OUT');
  const teaIn = [...events].reverse().find((e: any) => type(e) === 'TEA_IN');

  const lunchOpen = lunchOut && !lunchIn;
  const teaOpen = teaOut && (!teaIn || (teaOut && teaIn && teaOut.actualTime > teaIn.actualTime));

  const duration = (a?: string, b?: string) => (a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000) : a && !b ? Math.round((Date.now() - new Date(a).getTime()) / 60000) : null);

  if (historyQ.isLoading) return <Loading label="Loading break ledger…" />;

  return (
    <div className="col" style={{ gap: 14 }}>
      {(lunchOpen || teaOpen) && (
        <Panel accentTop title="Break In Progress">
          <div className="row" style={{ gap: 12 }}>
            <FiCoffee size={22} className="text-cyan" />
            <div className="grow col" style={{ gap: 2 }}>
              <span style={{ fontWeight: 700 }}>{lunchOpen ? 'LUNCH BREAK' : 'TEA BREAK'}</span>
              <span className="fs-12 text-mid">
                Started {formatTime(lunchOpen ? lunchOut.actualTime : teaOut.actualTime)} · elapsed {minutesToLabel(duration(lunchOpen ? lunchOut.actualTime : teaOut.actualTime)) || '0m'}
              </span>
            </div>
            <span className="badge badge-cyan">OPEN</span>
          </div>
        </Panel>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel title="LUNCH">
          <div className="col" style={{ gap: 8 }}>
            <div className="row-between">
              <span className="micro">OUT</span>
              <span className="mono fs-13">{lunchOut ? formatTime(lunchOut.actualTime) : '—'}</span>
            </div>
            <div className="row-between">
              <span className="micro">IN</span>
              <span className="mono fs-13">{lunchIn ? formatTime(lunchIn.actualTime) : lunchOpen ? <span className="text-amber">OPEN</span> : '—'}</span>
            </div>
            <div className="row-between">
              <span className="micro">DURATION</span>
              <span className="mono fs-13">{duration(lunchOut?.actualTime, lunchIn?.actualTime) != null ? minutesToLabel(duration(lunchOut!.actualTime, lunchIn!.actualTime)) : '—'}</span>
            </div>
          </div>
        </Panel>
        <Panel title="TEA BREAK">
          <div className="col" style={{ gap: 8 }}>
            <div className="row-between">
              <span className="micro">OUT</span>
              <span className="mono fs-13">{teaOut ? formatTime(teaOut.actualTime) : '—'}</span>
            </div>
            <div className="row-between">
              <span className="micro">IN</span>
              <span className="mono fs-13">{teaIn ? formatTime(teaIn.actualTime) : teaOpen ? <span className="text-amber">OPEN</span> : '—'}</span>
            </div>
            <div className="row-between">
              <span className="micro">DURATION</span>
              <span className="mono fs-13">{duration(teaOut?.actualTime, teaIn?.actualTime) != null ? minutesToLabel(duration(teaOut!.actualTime, teaIn!.actualTime)) : '—'}</span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Break Event History" bodyClass="">
        {events.filter((e: any) => ['LUNCH_OUT', 'LUNCH_IN', 'TEA_OUT', 'TEA_IN'].includes(type(e))).length === 0 ? (
          <EmptyState title="No break events today" hint="Your lunch and tea break records will appear here." />
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {events
              .filter((e: any) => ['LUNCH_OUT', 'LUNCH_IN', 'TEA_OUT', 'TEA_IN'].includes(type(e)))
              .map((e: any) => (
                <div key={e._id} className="event-card">
                  <div className="grow row-between">
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{e.eventTypeId?.name}</span>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono fs-12">{formatTime(e.actualTime)}</span>
                      <StatusBadge value={e.status} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
