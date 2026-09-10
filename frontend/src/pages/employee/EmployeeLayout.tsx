import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiHome, FiCalendar, FiCoffee, FiMapPin, FiUser, FiShield, FiLogOut, FiWifi, FiWifiOff } from 'react-icons/fi';
import { useAuthStore } from '../../store/authStore';
import { useRealtime } from '../../services/realtime';
import { authAPI } from '../../api';
import { Avatar } from '../../components/ui';

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
  return <div className="offline-banner">⚠ Offline — events will queue & sync securely</div>;
}

export default function EmployeeLayout() {
  const { user, logout } = useAuthStore();
  const { connected } = useRealtime();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {
      /* session cleared locally regardless */
    }
    logout();
    navigate('/login');
  };

  const nav = [
    { to: '/employee', label: 'Home', icon: <FiHome size={17} />, end: true },
    { to: '/employee/attendance', label: 'Events', icon: <FiCalendar size={17} /> },
    { to: '/employee/breaks', label: 'Breaks', icon: <FiCoffee size={17} /> },
    { to: '/employee/location', label: 'Location', icon: <FiMapPin size={17} /> },
    { to: '/employee/profile', label: 'Profile', icon: <FiUser size={17} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)' }}>
      <OfflineBanner />
      <header className="topbar">
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <Avatar photo={undefined} name={user?.email || 'E'} size="sm" round />
          <div className="col" style={{ gap: 0, minWidth: 0 }}>
            <span className="micro">AERO-OPS FIELD UNIT</span>
            <span className="fs-12 truncate">{user?.email}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className={`chip ${connected ? 'chip-green' : 'chip-red'}`}>
            {connected ? <FiWifi size={11} /> : <FiWifiOff size={11} />}
          </span>
          <NavLink to="/employee/security" className="nav-rail-btn" style={{ width: 36, height: 36 }} title="Security">
            <FiShield size={16} />
          </NavLink>
          <button className="nav-rail-btn" style={{ width: 36, height: 36, border: 'none', background: 'none' }} onClick={handleLogout} title="Logout">
            <FiLogOut size={16} />
          </button>
        </div>
      </header>

      <div className="emp-shell">
        <Outlet />
      </div>

      <nav className="emp-nav">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {n.icon}
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
