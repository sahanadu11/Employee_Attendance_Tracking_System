import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiMapPin, FiShield, FiAlertTriangle } from 'react-icons/fi';
import { gpsAPI, attendanceAPI } from '../../api';
import { Panel, GpsChip, Loading, EmptyState, formatTime, StatusBadge } from '../../components/ui';

export default function EmployeeLocation() {
  const [fix, setFix] = useState<{ lat: number; lon: number; accuracy: number; ts: number } | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [permission, setPermission] = useState<string>('unknown');

  const officesQ = useQuery({ queryKey: ['offices'], queryFn: gpsAPI.getOffices, staleTime: 300_000 });
  const historyQ = useQuery({ queryKey: ['my-attendance'], queryFn: () => attendanceAPI.history({ limit: 1 }) });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation unsupported on this device');
      return;
    }
    (navigator as any).permissions?.query({ name: 'geolocation' }).then((p: any) => {
      setPermission(p.state);
      p.onchange = () => setPermission(p.state);
    }).catch(() => {});
    const watch = navigator.geolocation.watchPosition(
      (pos) => setFix({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, ts: pos.timestamp }),
      (err) => setGpsError(err.code === 1 ? 'Location permission denied' : 'No location fix available'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const office = officesQ.data?.data?.[0];
  let distance: number | null = null;
  let inside: boolean | null = null;
  if (fix && office) {
    const R = 6371000;
    const dLat = ((office.latitude - fix.lat) * Math.PI) / 180;
    const dLon = ((office.longitude - fix.lon) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((fix.lat * Math.PI) / 180) * Math.cos((office.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    distance = Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    inside = distance <= (office.geofenceRadius || 100);
  }

  const accuracyOk = fix ? fix.accuracy <= 50 : null;

  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel accentTop title="Location Status">
        {fix ? (
          <div className="col" style={{ gap: 10 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <GpsChip status={inside === null ? 'UNAVAILABLE' : inside ? 'INSIDE' : 'OUTSIDE'} accuracy={fix.accuracy} />
              <span className={`badge ${accuracyOk ? 'badge-green' : 'badge-amber'}`}>
                ACCURACY {Math.round(fix.accuracy)}m {accuracyOk ? 'OK' : 'LOW'}
              </span>
              {permission === 'granted' && <span className="badge badge-green">PERMISSION GRANTED</span>}
            </div>
            <span className="mono fs-13 text-mid">{fix.lat.toFixed(6)}° N, {fix.lon.toFixed(6)}° E</span>
            <span className="micro">LIVE FIX · {formatTime(new Date(fix.ts))} · UPDATES AS YOU MOVE</span>
            {office && distance !== null && (
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 10px' }}>
                  <div className="micro">Office</div>
                  <div style={{ fontWeight: 700 }}>{office.name}</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 10px' }}>
                  <div className="micro">Distance</div>
                  <div style={{ fontWeight: 700, color: inside ? 'var(--green)' : 'var(--red)' }}>{distance}m</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 10px' }}>
                  <div className="micro">Ring</div>
                  <div style={{ fontWeight: 700 }}>{office.geofenceRadius}m</div>
                </div>
              </div>
            )}
            {inside === false && (
              <div className="row" style={{ gap: 8, background: 'var(--red-soft)', border: '1px solid rgba(255,107,94,0.4)', borderRadius: 8, padding: 12 }}>
                <FiAlertTriangle className="text-red" />
                <span className="fs-12 text-mid">
                  Attendance cannot be recorded because you are outside the permitted office location ({distance}m from {office?.name}, ring {office?.geofenceRadius}m).
                </span>
              </div>
            )}
            {inside === true && (
              <div className="row" style={{ gap: 8, background: 'var(--green-soft)', border: '1px solid rgba(56,224,162,0.4)', borderRadius: 8, padding: 12 }}>
                <FiShield className="text-green" />
                <span className="fs-12 text-mid">Office location verified. Attendance can continue.</span>
              </div>
            )}
          </div>
        ) : gpsError ? (
          <div className="col" style={{ gap: 8 }}>
            <span className="badge badge-violet">{permission === 'denied' ? 'PERMISSION DENIED' : 'GPS UNAVAILABLE'}</span>
            <span className="fs-12 text-mid">{gpsError}</span>
            <span className="micro">Attendance events that require GPS will be blocked until a fix is available.</span>
          </div>
        ) : (
          <Loading label="Acquiring satellite fix…" />
        )}
      </Panel>

      <Panel title="Privacy Notice">
        <div className="fs-12 text-mid" style={{ lineHeight: 1.7 }}>
          Your position is only collected when you submit an attendance event or explicitly enable location monitoring.
          Coordinates are stored with each event as evidence, access is restricted to authorized administrators,
          and every access is audit-logged. You can revoke browser location permission at any time — the system will
          then show GPS UNAVAILABLE and block location-dependent events rather than guessing.
        </div>
      </Panel>

      <Panel title="Last Recorded Position" bodyClass="">
        {historyQ.isLoading ? (
          <Loading />
        ) : !historyQ.data?.data?.events?.[0]?.latitude ? (
          <EmptyState title="No recorded position" hint="Your next attendance event will store its GPS evidence here." />
        ) : (
          (() => {
            const ev = historyQ.data.data.events[0];
            return (
              <div className="col" style={{ padding: 14, gap: 6 }}>
                <div className="row-between">
                  <span className="micro">AT LAST EVENT</span>
                  <span className="mono fs-12">{formatTime(ev.actualTime)}</span>
                </div>
                <span className="mono fs-13">{ev.latitude?.toFixed(5)}° N, {ev.longitude?.toFixed(5)}° E</span>
                <div className="row" style={{ gap: 6 }}>
                  <GpsChip status={ev.gpsStatus} accuracy={ev.gpsAccuracy} />
                  <StatusBadge value={ev.status} />
                </div>
              </div>
            );
          })()
        )}
      </Panel>
    </div>
  );
}
