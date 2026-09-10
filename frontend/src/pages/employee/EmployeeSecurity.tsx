import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShield, FiLogOut, FiClock } from 'react-icons/fi';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api';
import { Panel, StatusBadge } from '../../components/ui';

export default function EmployeeSecurity() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {
      /* clear local session regardless */
    }
    logout();
    navigate('/login');
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <Panel accentTop title="Session Security">
        <div className="col" style={{ gap: 10 }}>
          <div className="row-between" style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
            <span className="micro">SESSION STATE</span>
            <StatusBadge value="ACTIVE" />
          </div>
          <div className="row-between" style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
            <span className="micro">LOCK POLICY</span>
            <span className="fs-12">3 failed password attempts → 30 min lock</span>
          </div>
          <div className="row-between" style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
            <span className="micro">TOKEN REFRESH</span>
            <span className="fs-12">Automatic — access token renews every 15 min</span>
          </div>
          <div className="row-between" style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
            <span className="micro">FAILED ATTEMPTS</span>
            <span className="badge badge-green">0 / 3</span>
          </div>
        </div>
      </Panel>

      <Panel title="Protection Summary">
        <div className="col" style={{ gap: 8 }}>
          {[
            ['Password storage', 'bcrypt-hashed — plaintext never stored or logged'],
            ['Session handling', 'JWT access + rotating refresh token, revoked at logout'],
            ['Back-button protection', 'Protected routes require a live session; returning after expiry forces re-authentication'],
            ['Device binding', 'Each login records device and IP for review'],
          ].map(([k, v]) => (
            <div key={k} className="row" style={{ gap: 10, padding: '9px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
              <FiShield size={14} className="text-green" />
              <div className="col" style={{ gap: 1 }}>
                <span className="fs-13" style={{ fontWeight: 600 }}>{k}</span>
                <span className="fs-11 text-low">{v}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Logout">
        <div className="fs-12 text-mid mb-12">
          Logging out ends your session, revokes the refresh token, stops realtime and location updates,
          and records a logout audit event with timestamp and device information.
        </div>
        <button className="btn btn-danger btn-block" onClick={handleLogout}>
          <FiLogOut size={13} /> SIGN OUT & END SESSION
        </button>
      </Panel>
    </div>
  );
}
