import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export interface LiveAttendanceEvent {
  _id?: string;
  employeeDbId?: string;
  employeeName: string;
  employeeCode: string;
  employeePhoto?: string | null;
  section: string;
  flow: string;
  shift: string;
  event: string;
  eventCode: string;
  status: string;
  scheduledTime?: string;
  actualTime: string;
  lateDurationMinutes?: number;
  gpsStatus: string;
  gpsAccuracy?: number;
  source?: 'socket' | 'http';
}

interface RealtimeState {
  socket: Socket | null;
  connected: boolean;
  liveEvents: LiveAttendanceEvent[];
  lastEvent: LiveAttendanceEvent | null;
  clearLive: () => void;
}

const RealtimeContext = createContext<RealtimeState>({
  socket: null,
  connected: false,
  liveEvents: [],
  lastEvent: null,
  clearLive: () => {},
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveAttendanceEvent[]>([]);
  const { isAuthenticated, user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
    const s = io(base, { transports: ['websocket', 'polling'], reconnectionDelayMax: 10000 });

    s.on('connect', () => {
      setConnected(true);
      // Join appropriate rooms based on role
      const role = user?.role || 'EMPLOYEE';
      if (role === 'EMPLOYEE') {
        s.emit('join-employee', { employeeId: user?.employeeId });
      } else {
        s.emit('join-admin', {
          role,
          sectionId: user?.sectionId,
          flowId: user?.flowId,
        });
      }
    });

    s.on('disconnect', () => setConnected(false));

    s.on('attendance-event', (payload: any) => {
      const ev: LiveAttendanceEvent = {
        _id: payload.eventId || payload._id || `sock-${Date.now()}-${Math.random()}`,
        employeeDbId: payload.employeeId || payload.employeeDbId,
        employeeName: payload.employeeName,
        employeeCode: payload.employeeIdNum || payload.employeeCode,
        employeePhoto: payload.employeePhoto,
        section: payload.section || '—',
        flow: payload.flow || '—',
        shift: payload.shift || '—',
        event: payload.event,
        eventCode: payload.eventCode,
        status: payload.status,
        scheduledTime: payload.scheduledTime,
        actualTime: payload.actualTime,
        lateDurationMinutes: payload.lateDurationMinutes,
        gpsStatus: payload.gpsStatus,
        gpsAccuracy: payload.gpsAccuracy,
        source: 'socket',
      };
      setLiveEvents((prev) => [ev, ...prev].slice(0, 50));
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.role]);

  const clearLive = useCallback(() => setLiveEvents([]), []);

  return (
    <RealtimeContext.Provider value={{ socket, connected, liveEvents, lastEvent: liveEvents[0] || null, clearLive }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}

/** Merge socket events into an HTTP-fetched list (dedupe by employee+event+minute). */
export function mergeLiveEvents<T extends { employeeCode?: string; event?: string; actualTime: string }>(
  httpEvents: T[],
  socketEvents: LiveAttendanceEvent[],
  limit: number
): (T | LiveAttendanceEvent)[] {
  const seen = new Set(
    httpEvents.map((e) => `${e.employeeCode}|${e.event}|${new Date(e.actualTime).toISOString().slice(0, 16)}`)
  );
  const fresh = socketEvents.filter(
    (e) => !seen.has(`${e.employeeCode}|${e.event}|${new Date(e.actualTime).toISOString().slice(0, 16)}`)
  );
  return [...fresh, ...httpEvents].slice(0, limit);
}
