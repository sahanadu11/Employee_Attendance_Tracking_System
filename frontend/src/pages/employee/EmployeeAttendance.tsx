import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { eventTypeAPI, attendanceAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Panel, StatusBadge, GpsChip, Pipeline, Loading, ErrorState, EmptyState, formatTime, minutesToLabel } from '../../components/ui';
import toast from 'react-hot-toast';

const QUEUE_KEY = 'aeroops-pending-events';

interface PendingEvent {
  id: string;
  eventTypeId: string;
  eventName: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  ts: number;
}

export default function EmployeeAttendance() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [busyEvent, setBusyEvent] = useState('');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [pending, setPending] = useState<PendingEvent[]>([]);

  const eventsQ = useQuery({ queryKey: ['event-types'], queryFn: eventTypeAPI.getAll, staleTime: 300_000 });
  const historyQ = useQuery({ queryKey: ['my-attendance'], queryFn: () => attendanceAPI.history({ limit: 10 }), refetchInterval: 20_000 });


  const events = historyQ.data?.data?.events || [];
  const eventType = (ev: any) => ev.eventTypeId?.eventType || ev.eventTypeId?.code;
  const last = events[0];
  const lastType = last ? eventType(last) : undefined;
  const completed = new Set(events.map((e: any) => eventType(e)));

  // GPS acquisition
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported on this device');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => setGpsError(err.code === 1 ? 'Location permission denied — enable it in browser settings' : 'Unable to obtain a location fix'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
    const watch = navigator.geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  // Offline queue flush
  useEffect(() => {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) setPending(JSON.parse(stored));
  }, []);

  const flushQueue = async () => {
    for (const p of pending) {
      try {
        await attendanceAPI.submit({
          eventTypeId: p.eventTypeId,
          latitude: p.latitude,
          longitude: p.longitude,
          gpsAccuracy: p.gpsAccuracy,
          isIdempotentKey: p.id,
          deviceInfo: collectDeviceInfo(),
        });
      } catch {
        return; // stop on first failure, keep remainder queued
      }
    }
    setPending([]);
    localStorage.removeItem(QUEUE_KEY);
    toast.success('Queued events synchronized');
    qc.invalidateQueries({ queryKey: ['my-attendance'] });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
      }
    } catch {
      toast.error('Camera unavailable or permission denied');
    }
  };

  const capturePhoto = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480 * (v.videoHeight / Math.max(v.videoWidth, 1));
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    setPhotoData(canvas.toDataURL('image/jpeg', 0.7));
    const stream = v.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
    setCameraOn(false);
  };

  const submit = async (et: any) => {
    const type = et.eventType || et.code;
    if (cameraOn) { toast.error('Capture your photo first (or turn off camera)'); return; }

    const payload: any = {
      eventTypeId: et._id,
      latitude: coords?.lat,
      longitude: coords?.lon,
      gpsAccuracy: coords?.accuracy,
      photoData: photoData || undefined,
      faceVerificationResult: 'NOT_REQUIRED',
      isIdempotentKey: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      deviceInfo: collectDeviceInfo(),
    };

    setBusyEvent(et._id);
    try {
      const { data } = await attendanceAPI.submit(payload);
      toast.success(data.message || `${et.name} recorded`);
      setPhotoData(null);
      qc.invalidateQueries({ queryKey: ['my-attendance'] });
      qc.invalidateQueries({ queryKey: ['my-pipeline'] });
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'INVALID_SEQUENCE') {
        toast.error(err.response?.data?.message || 'This event cannot be submitted yet');
      } else if (code === 'PHOTO_REQUIRED') {
        toast.error('Photo evidence is required for this event — enable the camera');
        setCameraOn(true);
      } else if (navigator.onLine === false) {
        const p: PendingEvent = {
          id: payload.isIdempotentKey,
          eventTypeId: et._id,
          eventName: et.name,
          latitude: coords?.lat,
          longitude: coords?.lon,
          gpsAccuracy: coords?.accuracy,
          ts: Date.now(),
        };
        const next = [p, ...pending];
        setPending(next);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
        toast('Offline — event queued and will sync securely', { icon: '⏳' });
      } else {
        toast.error(err.response?.data?.message || 'Submission failed');
      }
    } finally {
      setBusyEvent('');
    }
  };

  const eventTypes = (eventsQ.data?.data || []) as any[];

  return (
    <div className="col" style={{ gap: 14 }}>
      {/* GPS status */}
      <Panel accentTop title="Location Verification">
        {coords ? (
          <div className="col" style={{ gap: 8 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <GpsChip status="INSIDE" accuracy={coords.accuracy} />
              <span className="chip">±{Math.round(coords.accuracy)}m REPORTED ACCURACY</span>
            </div>
            <span className="mono fs-12 text-mid">
              {coords.lat.toFixed(5)}° · {coords.lon.toFixed(5)}°
            </span>
          </div>
        ) : gpsError ? (
          <div className="col" style={{ gap: 8 }}>
            <span className="badge badge-violet">PERMISSION DENIED</span>
            <span className="fs-12 text-mid">{gpsError}</span>
            <button className="btn btn-sm" onClick={() => window.location.reload()}>RETRY PERMISSION</button>
          </div>
        ) : (
          <Loading label="Acquiring GPS fix…" />
        )}
      </Panel>

      {/* Camera */}
      <Panel title="Photo Evidence" actions={<span className="micro">{photoData ? 'CAPTURED ✓' : cameraOn ? 'CAMERA LIVE' : 'OPTIONAL'}</span>}>
        {cameraOn ? (
          <div className="col" style={{ gap: 10 }}>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 10, background: '#000' }} playsInline muted />
            <button className="btn btn-primary" onClick={capturePhoto}>◉ CAPTURE</button>
          </div>
        ) : photoData ? (
          <div className="col" style={{ gap: 10 }}>
            <img src={photoData} alt="capture" style={{ width: 160, borderRadius: 10, border: '1px solid var(--line-bright)' }} />
            <button className="btn btn-sm" onClick={() => setPhotoData(null)}>RETAKe</button>
          </div>
        ) : (
          <div>
            <button className="btn" onClick={startCamera}>◉ ENABLE CAMERA</button>
            <div className="micro mt-8">Photo is attached to events that require evidence. Camera permission is requested explicitly.</div>
          </div>
        )}
      </Panel>

      {/* Event submission */}
      <Panel title="Attendance Events" bodyClass="">
        {eventTypes.length === 0 ? (
          <Loading label="Loading event definitions…" />
        ) : (
          <div className="col" style={{ padding: 12, gap: 8 }}>
            {eventTypes.filter((e: any) => e.isActive).map((et: any) => {
              const type = et.eventType || et.code;
              const done = completed.has(type);
              const isNext = !done;
              return (
                <button
                  key={et._id}
                  className="btn"
                  style={{ justifyContent: 'space-between', padding: '14px 16px', opacity: busyEvent === et._id ? 0.6 : 1 }}
                  disabled={busyEvent === et._id}
                  onClick={() => submit(et)}
                >
                  <span className="row" style={{ gap: 10 }}>
                    <span className="chip chip-blue">{et.sequenceNumber}</span>
                    <span className="col" style={{ gap: 1, textAlign: 'left' }}>
                      <span style={{ fontSize: 13 }}>{et.name}</span>
                      <span className="micro">{et.requiresPhoto ? 'PHOTO REQUIRED' : 'PHOTO OPTIONAL'} · {et.requiresGps ? 'GPS REQUIRED' : 'GPS OPTIONAL'}</span>
                    </span>
                  </span>
                  {busyEvent === et._id ? <span className="micro">SUBMITTING…</span> : <span className="micro">TAP TO SUBMIT →</span>}
                </button>
              );
            })}
            <span className="micro">Out-of-sequence submissions are rejected by the engine and explained.</span>
          </div>
        )}
      </Panel>

      {/* Offline queue */}
      {pending.length > 0 && (
        <Panel title={`Pending Sync (${pending.length})`} actions={<button className="btn btn-sm btn-primary" onClick={flushQueue}>SYNC NOW</button>}>
          <div className="col" style={{ gap: 6 }}>
            {pending.map((p) => (
              <div key={p.id} className="row-between" style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                <span className="fs-12">{p.eventName}</span>
                <span className="badge badge-amber">QUEUED · {formatTime(new Date(p.ts))}</span>
              </div>
            ))}
            <span className="micro">Events are stored locally with idempotency keys and synchronized with duplicate protection.</span>
          </div>
        </Panel>
      )}

      {/* Recent events */}
      <Panel title="Recent Events" bodyClass="">
        {events.length === 0 ? (
          <EmptyState title="No events today" />
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {events.map((ev: any, i: number) => (
              <div key={ev._id || i} className="event-card">
                <div className="grow col" style={{ gap: 3 }}>
                  <div className="row-between">
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{ev.eventTypeId?.name}</span>
                    <span className="micro">{formatTime(ev.actualTime)}</span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <StatusBadge value={ev.status} />
                    {ev.lateDurationMinutes ? <span className="badge badge-red">+{ev.lateDurationMinutes}m</span> : null}
                    <GpsChip status={ev.gpsStatus} accuracy={ev.gpsAccuracy} />
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

function collectDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: (navigator as any).platform || 'unknown',
    browser: /Chrome/.test(navigator.userAgent) ? 'Chrome' : /Firefox/.test(navigator.userAgent) ? 'Firefox' : /Safari/.test(navigator.userAgent) ? 'Safari' : 'Browser',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
  };
}
