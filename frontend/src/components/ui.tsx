import React from 'react';

/* ---------- Badge / status helpers ---------- */

const STATUS_TONES: Record<string, string> = {
  ON_TIME: 'badge-green',
  EARLY: 'badge-cyan',
  GRACE_PERIOD: 'badge-amber',
  LATE: 'badge-red',
  MISSED: 'badge-gray',
  INVALID: 'badge-red',
  BLOCKED: 'badge-red',
  GPS_FAILURE: 'badge-amber',
  SECURITY_LOCK: 'badge-violet',
  INSIDE: 'badge-green',
  OUTSIDE: 'badge-red',
  UNAVAILABLE: 'badge-gray',
  INACCURATE: 'badge-amber',
  PERMISSION_DENIED: 'badge-violet',
  VERIFIED: 'badge-green',
  FAILED: 'badge-red',
  NOT_REQUIRED: 'badge-gray',
  ACTIVE: 'badge-green',
  INACTIVE: 'badge-gray',
  ABSENT: 'badge-gray',
  PRESENT: 'badge-green',
  ON_LUNCH: 'badge-cyan',
  ON_TEA: 'badge-cyan',
  SIGNED_OUT: 'badge-gray',
  UP: 'badge-green',
  DOWN: 'badge-red',
  CONNECTING: 'badge-amber',
  SUCCESS: 'badge-green',
  FAILURE: 'badge-red',
};

export function StatusBadge({ value, dot = false }: { value?: string | null; dot?: boolean }) {
  if (!value) return <span className="badge badge-gray">—</span>;
  const tone = STATUS_TONES[value] || 'badge-gray';
  const label = value.replace(/_/g, ' ');
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="dot" style={{ background: 'currentColor' }} />}
      {label}
    </span>
  );
}

export function StateBadge({ state }: { state: string }) {
  const map: Record<string, { tone: string; label: string }> = {
    PRESENT: { tone: 'badge-green', label: 'PRESENT' },
    LATE: { tone: 'badge-red', label: 'LATE' },
    ABSENT: { tone: 'badge-gray', label: 'ABSENT' },
    ON_LUNCH: { tone: 'badge-cyan', label: 'ON LUNCH' },
    ON_TEA: { tone: 'badge-cyan', label: 'ON TEA' },
    SIGNED_OUT: { tone: 'badge-gray', label: 'SIGNED OUT' },
  };
  const m = map[state] || { tone: 'badge-gray', label: state };
  return <span className={`badge ${m.tone}`}>{m.label}</span>;
}

/* ---------- Avatar ---------- */

const AVATAR_SIZES: Record<string, number> = { xs: 24, sm: 34, md: 44, lg: 64, xl: 120 };

export function Avatar({ photo, name, size = 'md', round = false }: { photo?: string | null; name: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; round?: boolean }) {
  const px = AVATAR_SIZES[size] || 44;
  if (photo) {
    return <img src={photo} alt={name} className="avatar" style={{ width: px, height: px, borderRadius: round ? '50%' : 8 }} />;
  }
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="avatar-fallback" style={{ width: px, height: px, fontSize: px * 0.36, borderRadius: round ? '50%' : 8 }}>
      {initials}
    </div>
  );
}

/* ---------- KPI card ---------- */

export function KpiCard({
  label,
  value,
  sub,
  tone = 'blue',
  delta,
  icon,
  onClick,
  footLeft,
  footRight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'blue' | 'green' | 'red' | 'amber' | 'cyan' | 'violet';
  delta?: number;
  icon?: React.ReactNode;
  onClick?: () => void;
  footLeft?: React.ReactNode;
  footRight?: React.ReactNode;
}) {
  return (
    <div className={`kpi tone-${tone} ${onClick ? 'clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="kpi-head">
        <span className="micro">{label}</span>
        {icon}
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {(footLeft || footRight || delta !== undefined) && (
        <div className="kpi-foot">
          <span className="micro">{footLeft}</span>
          {delta !== undefined && (
            <span className={`fs-11 mono ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'text-low'}`}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta)}%
            </span>
          )}
          {footRight && <span className="micro">{footRight}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- Panel ---------- */

export function Panel({
  title,
  actions,
  children,
  accentTop,
  bodyClass,
  icon,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  accentTop?: boolean;
  bodyClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`panel ${accentTop ? 'panel-accent-top' : ''}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div className="row" style={{ gap: 8 }}>
            {icon}
            {title && <span className="panel-title">{title}</span>}
          </div>
          {actions}
        </div>
      )}
      <div className={bodyClass ?? 'panel-body'}>{children}</div>
    </div>
  );
}

/* ---------- Loading / empty / error states ---------- */

export function Loading({ label = 'Acquiring telemetry…' }: { label?: string }) {
  return (
    <div className="state-box">
      <div className="spinner" />
      <span className="micro">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = '◌', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="state-box">
      <div style={{ fontSize: 30, opacity: 0.5 }}>{icon}</div>
      <div className="panel-title text-mid">{title}</div>
      {hint && <div className="fs-12 text-low" style={{ maxWidth: 340 }}>{hint}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-box">
      <div style={{ fontSize: 30 }}>⚠</div>
      <div className="panel-title text-red">Data link failure</div>
      <div className="fs-12 text-low" style={{ maxWidth: 380 }}>{message}</div>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/* ---------- Avatar cell for tables ---------- */

export function EmployeeCell({ photo, name, code, sub }: { photo?: string | null; name?: string; code?: string; sub?: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <Avatar photo={photo} name={name || '?'} size="sm" />
      <div className="col" style={{ gap: 1, minWidth: 0 }}>
        <span className="fs-13" style={{ fontWeight: 600 }}>{name || '—'}</span>
        <span className="micro">{code}</span>
        {sub}
      </div>
    </div>
  );
}

/* ---------- Pipeline (attendance event sequence) ---------- */

export function Pipeline({ steps }: { steps: { code: string; label: string; status: 'done' | 'current' | 'upcoming' | 'failed'; time?: string }[] }) {
  return (
    <div className="pipeline">
      {steps.map((s, i) => (
        <React.Fragment key={s.code + i}>
          {i > 0 && <span className="pipeline-arrow">→</span>}
          <span className={`pipeline-step ${s.status}`} title={s.time ? `${s.label} · ${s.time}` : s.label}>
            {s.label}
            {s.time ? <span style={{ opacity: 0.75 }}> {s.time}</span> : null}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- GPS chip ---------- */

export function GpsChip({ status, accuracy }: { status?: string | null; accuracy?: number | null }) {
  const tone = status === 'INSIDE' ? 'chip-green' : status === 'OUTSIDE' ? 'chip-red' : status === 'INACCURATE' ? 'chip-red' : status === 'PERMISSION_DENIED' ? 'chip-blue' : '';
  const label = status ? status.replace(/_/g, ' ') : 'GPS —';
  return (
    <span className={`chip ${tone}`}>
      ⌖ {label}
      {accuracy !== undefined && accuracy !== null ? ` ${Math.round(accuracy)}m` : ''}
    </span>
  );
}

/* ---------- Live display countdown hook ---------- */

export function useFreshEvents<T extends { _id?: string; actualTime: string }>(events: T[], windowMs: number): Set<string> {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const fresh = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of events) {
      if (e._id && now - new Date(e.actualTime).getTime() < windowMs) s.add(e._id);
    }
    return s;
  }, [events, windowMs, now]);
  return fresh;
}

export function formatTime(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function minutesToLabel(m?: number | null): string {
  if (m === undefined || m === null) return '—';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Download any array of rows as CSV (client-side export). */
export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
