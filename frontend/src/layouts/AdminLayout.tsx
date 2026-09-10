import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  FiGrid, FiRadio, FiUsers, FiUserPlus, FiLayers, FiGitBranch, FiClock, FiCheckSquare,
  FiAlertTriangle, FiCoffee, FiCrosshair, FiMapPin, FiList, FiBarChart2, FiShield,
  FiFileText, FiBell, FiMonitor, FiSettings, FiLogOut, FiCamera, FiWifi, FiWifiOff,
} from 'react-icons/fi';
import { useAuthStore } from '../store/authStore';
import { useRealtime } from '../services/realtime';
import { authAPI } from '../api';
import { Avatar } from '../components/ui';
import InstallPrompt from '../components/InstallPrompt';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const ALL = ['SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN', 'FLOW_ADMIN'];
const EXEC = ['SUPER_ADMIN', 'MAIN_ADMIN'];

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Command Center', icon: <FiGrid size={19} />, roles: ALL },
  { to: '/monitor', label: 'Live Monitor', icon: <FiRadio size={19} />, roles: ALL },
  { to: '/photo-monitor', label: 'Photo Monitor', icon: <FiCamera size={19} />, roles: ALL },
  { to: '/employees', label: 'Employees', icon: <FiUserPlus size={19} />, roles: ALL },
  { to: '/sections', label: 'Sections', icon: <FiLayers size={19} />, roles: ['SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'] },
  { to: '/flows', label: 'Flows', icon: <FiGitBranch size={19} />, roles: ALL },
  { to: '/shifts', label: 'Shifts', icon: <FiClock size={19} />, roles: ALL },
  { to: '/attendance', label: 'Attendance', icon: <FiCheckSquare size={19} />, roles: ALL },
  { to: '/late', label: 'Late', icon: <FiAlertTriangle size={19} />, roles: ALL },
  { to: '/breaks-dash', label: 'Breaks', icon: <FiCoffee size={19} />, roles: ALL },
  { to: '/gps', label: 'GPS Tracking', icon: <FiCrosshair size={19} />, roles: ALL },
  { to: '/geofence', label: 'Geofence', icon: <FiMapPin size={19} />, roles: ALL },
  { to: '/events', label: 'Event Engine', icon: <FiList size={19} />, roles: ALL },
  { to: '/reports', label: 'Reports', icon: <FiBarChart2 size={19} />, roles: ALL },
  { to: '/security', label: 'Security', icon: <FiShield size={19} />, roles: ['SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'] },
  { to: '/audit', label: 'Audit Ledger', icon: <FiFileText size={19} />, roles: ['SUPER_ADMIN', 'MAIN_ADMIN', 'SECTION_ADMIN'] },
  { to: '/notifications', label: 'Notifications', icon: <FiBell size={19} />, roles: ALL },
  { to: '/sessions', label: 'Sessions', icon: <FiMonitor size={19} />, roles: EXEC },
  { to: '/settings', label: 'Settings', icon: <FiSettings size={19} />, roles: EXEC },
];

function ZuluClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return <span>{`${hh}:${mm}:${ss}Z`}</span>;
}

export default function AdminLayout() {
  const { user, logout, refreshToken } = useAuthStore();
  const { connected } = useRealtime();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const role = user?.role || 'EMPLOYEE';
  const items = NAV_ITEMS.filter((n) => n.roles.includes(role));
  const current = NAV_ITEMS.find((n) => n.to === location.pathname) || (location.pathname === '/' ? NAV_ITEMS[0] : undefined);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {
      /* session cleared locally regardless */
    }
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <OfflineBanner />
      <nav className="nav-rail">
        <NavLink to="/" className="nav-rail-btn" title="Command Center" style={{ marginBottom: 8 }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: 9, background: 'var(--accent-soft)',
              border: '1px solid rgba(79,140,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8db4ff',
            }}
          >
            <FiGrid size={17} />
          </div>
        </NavLink>
        <div style={{ width: 26, height: 1, background: 'var(--line)', margin: '4px 0 8px' }} />
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-rail-btn ${isActive ? 'active' : ''}`} title={item.label}>
            {item.icon}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <button className="nav-rail-btn" title="Logout" onClick={handleLogout} style={{ border: 'none', background: 'none' }}>
          <FiLogOut size={18} />
        </button>
      </nav>

      <div style={{ marginLeft: 64 }}>
        <header className="topbar">
          <div className="row" style={{ gap: 14, minWidth: 0 }}>
            <div className="col" style={{ gap: 0, lineHeight: 1.05 }}>
              <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.06em' }}>AERO-OPS</span>
              <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', color: '#8db4ff' }}>TELEMETRY</span>
            </div>
            <div style={{ width: 1, height: 26, background: 'var(--line)' }} />
            <div className="col hidden-sm" style={{ gap: 0 }}>
              <span className="micro">Vanguard Command</span>
              <span className="micro-bright micro">{role.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            {current && <span className="chip chip-blue">{current.label}</span>}
            <span className={`chip ${connected ? 'chip-green' : 'chip-red'}`} title="WebSocket event pump">
              {connected ? <FiWifi size={11} /> : <FiWifiOff size={11} />} {connected ? 'WS LIVE' : 'WS OFFLINE'}
            </span>
            <span className="chip hidden-sm">◷ <ZuluClock /></span>
            <div style={{ position: 'relative' }}>
              <button
                className="row pointer"
                style={{ gap: 8, background: 'none', border: '1px solid var(--line)', borderRadius: 7, padding: '4px 10px 4px 5px', color: 'inherit' }}
                onClick={() => setShowUserMenu((v) => !v)}
              >
                <Avatar photo={undefined} name={user?.email || 'A'} size="xs" round />
                <span className="micro-bright micro">{(user?.email || '').split('@')[0]}</span>
              </button>
              {showUserMenu && (
                <div
                  className="panel"
                  style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 230, zIndex: 90, padding: 10 }}
                  onMouseLeave={() => setShowUserMenu(false)}
                >
                  <div className="col" style={{ gap: 2, padding: '4px 6px 10px' }}>
                    <span className="fs-12 truncate">{user?.email}</span>
                    <span className="micro">{role.replace(/_/g, ' ')}</span>
                  </div>
                  <button className="btn btn-sm btn-block" onClick={handleLogout}>
                    <FiLogOut size={12} /> Sign out
                  </button>
                </div>
              )}
            </div>
            {role === 'SUPER_ADMIN' && (
              <button
                className="btn btn-danger hidden-sm"
                title="Emergency override — acknowledge all critical alerts"
                onClick={() => navigate('/security')}
              >
                ⚠ Emergency Override
              </button>
            )}
          </div>
        </header>

        <main style={{ padding: '18px 20px 40px' }}>
          <InstallPrompt />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return <div className="offline-banner">⚠ Offline — attendance submissions will queue and sync when connection restores</div>;
}
