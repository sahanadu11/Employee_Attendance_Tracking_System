import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { gpsAPI } from '../../api';
import { Avatar, StatusBadge, Panel, Loading, ErrorState, GpsChip } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';

export default function EmployeeProfile() {
  const { user } = useAuthStore();
  const meQ = useQuery({ queryKey: ['me'], queryFn: gpsAPI.getMe, staleTime: 120_000 });
  const me = meQ.data?.data;

  if (meQ.isLoading) return <Loading label="Loading personnel file…" />;
  if (meQ.isError) return <ErrorState message={String(meQ.error)} onRetry={() => meQ.refetch()} />;

  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel accentTop>
        <div className="row" style={{ gap: 16 }}>
          <Avatar photo={me?.photo} name={me?.fullName || user?.email || 'E'} size="xl" />
          <div className="col" style={{ gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{me?.fullName || user?.email}</span>
            {me?.employeeId && <span className="chip chip-blue" style={{ alignSelf: 'flex-start' }}>{me.employeeId}</span>}
            <span className="micro">{user?.email}</span>
            <div className="row" style={{ gap: 6 }}>
              <StatusBadge value={me?.isActive ? 'ACTIVE' : 'INACTIVE'} />
              <span className="badge badge-gray">{String(user?.role).replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Organization Assignment">
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['SECTION', me?.sectionId?.name],
            ['FLOW', me?.flowId?.name],
            ['SHIFT', me?.shiftId ? `${me.shiftId.name} (${me.shiftId.startTime}–${me.shiftId.endTime})` : undefined],
            ['DEPARTMENT', me?.department],
            ['JOB TITLE', me?.jobTitle],
            ['JOINING DATE', me?.joiningDate ? new Date(me.joiningDate).toLocaleDateString() : undefined],
          ].map(([k, v]) => (
            <div key={String(k)} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
              <div className="micro">{k}</div>
              <div className="fs-13" style={{ fontWeight: 600 }}>{v || '—'}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Contact">
        <div className="col" style={{ gap: 8 }}>
          <div className="row-between" style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
            <span className="micro">PHONE</span>
            <span className="mono fs-13">{me?.phone || '—'}</span>
          </div>
          <div className="row-between" style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
            <span className="micro">EMAIL</span>
            <span className="mono fs-13 truncate" style={{ maxWidth: 220 }}>{me?.email || user?.email}</span>
          </div>
          {me?.emergencyContact?.name && (
            <div className="row-between" style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
              <span className="micro">EMERGENCY</span>
              <span className="fs-13">{me.emergencyContact.name} · {me.emergencyContact.phone}</span>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Privacy & Data">
        <div className="fs-12 text-mid" style={{ lineHeight: 1.7 }}>
          Photographs and location evidence are retained per the organization's configured retention policy and are
          visible only to authorized roles. Access to your records is audit-logged. Contact your administrator for
          data export or deletion requests under applicable privacy rules.
        </div>
      </Panel>
    </div>
  );
}
