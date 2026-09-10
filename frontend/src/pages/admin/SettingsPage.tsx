import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiSettings, FiSave } from 'react-icons/fi';
import { settingsAPI } from '../../api';
import { Panel, Loading, ErrorState, KpiCard } from '../../components/ui';
import toast from 'react-hot-toast';

const GROUPS: { title: string; keys: { key: string; label: string; type?: 'number' | 'text' }[] }[] = [
  {
    title: 'Security & Lock Policy',
    keys: [
      { key: 'MAX_LOGIN_ATTEMPTS', label: 'Failed attempts before lock', type: 'number' },
      { key: 'LOCKOUT_DURATION_MINUTES', label: 'Lock duration (minutes)', type: 'number' },
    ],
  },
  {
    title: 'Live Display & Realtime',
    keys: [
      { key: 'LIVE_DISPLAY_DURATION_SECONDS', label: 'Live photo flash duration (seconds)', type: 'number' },
      { key: 'GPS_UPDATE_INTERVAL_MS', label: 'Location update interval (ms)', type: 'number' },
    ],
  },
  {
    title: 'GPS & Geofence',
    keys: [
      { key: 'GPS_ACCURACY_THRESHOLD', label: 'Max acceptable GPS accuracy (meters)', type: 'number' },
      { key: 'GEOFENCE_DEFAULT_RADIUS', label: 'Default geofence radius (meters)', type: 'number' },
    ],
  },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: settingsAPI.getAll });
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settingsQ.data?.data) setDraft({ ...settingsQ.data.data });
  }, [settingsQ.data]);

  const save = async (key: string) => {
    setBusy(true);
    try {
      await settingsAPI.update({ key, value: draft[key] });
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success(`${key} saved — change recorded to audit ledger`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (settingsQ.isLoading) return <Loading label="Loading configuration…" />;
  if (settingsQ.isError) return <ErrorState message={String(settingsQ.error)} onRetry={() => settingsQ.refetch()} />;

  const configured = Object.keys(draft).length;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Configured Keys" value={configured} tone="blue" icon={<FiSettings size={15} />} />
        <KpiCard label="Unsaved Changes" value={Object.keys(draft).filter((k) => settingsQ.data?.data?.[k] !== undefined && draft[k] !== settingsQ.data.data[k]).length} tone="amber" />
      </div>

      {GROUPS.map((g) => (
        <Panel key={g.title} title={g.title} bodyClass="">
          {g.keys.map((k) => (
            <div key={k.key} className="row-between wrap" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)', gap: 10 }}>
              <div className="col" style={{ gap: 2, minWidth: 220 }}>
                <span className="fs-13" style={{ fontWeight: 600 }}>{k.label}</span>
                <span className="micro">{k.key}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  style={{ width: 140 }}
                  type={k.type === 'number' ? 'number' : 'text'}
                  value={draft[k.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [k.key]: k.type === 'number' ? Number(e.target.value) : e.target.value })}
                />
                <button
                  className="btn btn-sm btn-primary"
                  disabled={busy || draft[k.key] === settingsQ.data?.data?.[k.key]}
                  onClick={() => save(k.key)}
                >
                  <FiSave size={11} /> SAVE
                </button>
              </div>
            </div>
          ))}
        </Panel>
      ))}

      <Panel title="Environment">
        <div className="fs-12 text-mid" style={{ lineHeight: 1.7 }}>
          Changes here are persisted in MongoDB (system_settings collection) and take effect within 30 seconds via the
          settings cache. Every change is written to the audit ledger with your identity, the previous value, and the
          new value. Secrets (JWT keys, connection strings) are managed exclusively through environment variables —
          never through this interface.
        </div>
      </Panel>
    </div>
  );
}
