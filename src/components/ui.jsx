import React from 'react';
import { ArrowLeft } from 'lucide-react';

export function Header({ title, subtitle, onBack, right }) {
  return (
    <div className="header">
      {onBack && (
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={17} /></button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="header-title">{title}</div>
        {subtitle && <div className="header-sub">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function Alert({ type = 'info', icon, children }) {
  const icons = { danger: '⚠️', warn: '⚡', info: 'ℹ️', success: '✓' };
  return (
    <div className={`alert alert-${type}`}>
      <span className="alert-icon">{icon || icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

// One theme only now — nothing to toggle. Kept as a no-op so every screen
// that still renders <ThemeToggle/> doesn't need to be touched individually.
export function ThemeToggle() {
  return null;
}

export function PaymentBadge({ mode }) {
  const cls = `pm-badge pm-${(mode || 'Cash').replace(/\s+/g, '')}`;
  const icons = { Cash: '💵', GPay: '📱', PhonePe: '📲', Paytm: '💳', 'Bank Transfer': '🏦', Cheque: '📝', Other: '🔷' };
  return <span className={cls}>{icons[mode] || '💳'} {mode || 'Cash'}</span>;
}

export function EmptyState({ icon, title, sub }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      {title && <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: 'var(--text2)' }}>{title}</div>}
      {sub && <div className="empty-text">{sub}</div>}
    </div>
  );
}

export function fmt(n) {
  return `₹${Math.abs(Number(n)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return d; }
}

export function initials(name = '') {
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// Maps a group's `type` to its dashboard screen name — shared by every screen that navigates to a group.
export function dashRoute(type) {
  return type === 'family' ? 'familyDash' : type === 'splitwise' ? 'splitwiseDash' : 'dashboard';
}
