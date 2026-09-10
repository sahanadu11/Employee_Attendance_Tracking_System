import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiMapPin } from 'react-icons/fi';
import { dashboardAPI } from '../../api';
import { Panel, KpiCard, StatusBadge, Loading, ErrorState, EmptyState, formatDateTime } from '../../components/ui';

export default function GeofenceDashboard() {
  const gfQ = useQuery({ queryKey: ['dash-geofence'], queryFn: dashboardAPI.geofence, refetchInterval: 60_000 });
  const data = gfQ.data?.data;
  const breakdown = data?.statusBreakdown || {};

  if (gfQ.isLoading) return <Loading label="Loading perimeter definitions…" />;
  if (gfQ.isError) return <ErrorState message={String(gfQ.error)} onRetry={() => gfQ.refetch()} />;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Location Verified" value={breakdown.inside ?? 0} tone="green" sub="inside ring, accuracy within policy" />
        <KpiCard label="Location Outside" value={breakdown.outside ?? 0} tone="red" sub="beyond geofence radius" />
        <KpiCard label="GPS Inaccurate" value={breakdown.inaccurate ?? 0} tone="amber" sub="device error exceeds threshold" />
        <KpiCard label="GPS Unavailable" value={breakdown.unavailable ?? 0} tone="violet" sub="no fix / permission denied" />
      </div>

      <Panel title="Office Locations & Perimeter Rings" icon={<FiMapPin size={15} className="text-blue" />} bodyClass="">
        {(data?.offices || []).length === 0 ? (
          <EmptyState title="No offices configured" hint="Create office locations with latitude/longitude and a geofence radius." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Office</th><th>Latitude</th><th>Longitude</th><th>Radius</th><th>Inside</th><th>Outside</th><th>Poor GPS</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(data?.offices || []).map((o: any) => (
                  <tr key={o._id}>
                    <td>
                      <div className="col" style={{ gap: 1 }}>
                        <span style={{ fontWeight: 700 }}>{o.name}</span>
                        <span className="micro">{o.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                      </div>
                    </td>
                    <td className="mono fs-12">{o.latitude?.toFixed(5)}°</td>
                    <td className="mono fs-12">{o.longitude?.toFixed(5)}°</td>
                    <td><span className="chip chip-green">{o.geofenceRadius}m RING</span></td>
                    <td><span className="badge badge-green">{o.employeesInside}</span></td>
                    <td><span className="badge badge-red">{o.employeesOutside}</span></td>
                    <td><span className="badge badge-amber">{o.poorAccuracy}</span></td>
                    <td><StatusBadge value={o.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Accuracy Policy Reference">
        <div className="grid grid-2">
          <div className="col" style={{ gap: 10 }}>
            <span className="micro">HOW VERIFICATION WORKS</span>
            <div className="fs-12 text-mid" style={{ lineHeight: 1.7 }}>
              The device reports latitude, longitude, and horizontal accuracy. The engine computes the haversine distance to the office coordinate and compares it against the configured ring radius. A fix is <span className="text-green">VERIFIED</span> only when the distance is inside the ring <em>and</em> the reported accuracy is within the configured threshold. If the device reports poor accuracy (accuracy radius larger than the policy threshold), the event is flagged <span className="text-amber">INACCURATE</span> — never silently approved. Browsers cannot guarantee 1-meter physical accuracy; the radar treats the reported accuracy as the honest confidence bound.
            </div>
          </div>
          <div className="col" style={{ gap: 10 }}>
            <span className="micro">LOCATION STATES</span>
            {[
              ['LOCATION VERIFIED', 'badge-green', 'Distance inside ring + accuracy OK'],
              ['LOCATION OUTSIDE', 'badge-red', 'Distance exceeds geofence radius'],
              ['GPS INACCURATE', 'badge-amber', 'Reported accuracy worse than threshold'],
              ['GPS UNAVAILABLE', 'badge-gray', 'No position fix obtained'],
              ['PERMISSION DENIED', 'badge-violet', 'User declined location permission'],
            ].map(([label, tone, desc]) => (
              <div key={label} className="row-between" style={{ padding: '7px 10px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                <span className={`badge ${tone}`}>{label}</span>
                <span className="fs-11 text-low">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
