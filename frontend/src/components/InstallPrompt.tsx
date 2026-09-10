import React, { useEffect, useState } from 'react';
import { FiDownload } from 'react-icons/fi';

let deferredPrompt: any = null;

export default function InstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('pwa-dismissed') === '1');

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!canInstall || dismissed) return null;

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
  };

  return (
    <div
      className="row"
      style={{
        gap: 10, padding: '10px 14px', margin: '0 0 12px',
        background: 'var(--accent-soft)', border: '1px solid rgba(79,140,255,0.4)', borderRadius: 10,
      }}
    >
      <FiDownload size={16} style={{ color: '#8db4ff' }} />
      <span className="fs-12 grow" style={{ color: 'var(--text-mid)' }}>
        Install AERO-OPS on this device for offline-capable attendance and faster launches.
      </span>
      <button className="btn btn-sm btn-primary" onClick={install}>INSTALL</button>
      <button className="btn btn-sm btn-ghost" onClick={() => { sessionStorage.setItem('pwa-dismissed', '1'); setDismissed(true); }}>✕</button>
    </div>
  );
}
