import React from 'react';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import homeBlue from '../assets/icons/home-blue.png';
import homeWhite from '../assets/icons/home-white.png';
import tripBlue from '../assets/icons/trip-blue.png';
import tripWhite from '../assets/icons/trip-white.png';
import splitwiseBlue from '../assets/icons/splitwise-blue.png';
import splitwiseWhite from '../assets/icons/splitwise-white.png';

const TYPE_ICONS = {
  family:    { light: homeBlue,      dark: homeWhite },
  trip:      { light: tripBlue,      dark: tripWhite },
  splitwise: { light: splitwiseBlue, dark: splitwiseWhite },
};

// Group-type identity icon — swaps to the light/dark variant automatically.
export function TypeIcon({ type, size = '52%' }) {
  const { theme } = useTheme();
  const set = TYPE_ICONS[type] || TYPE_ICONS.trip;
  return <img src={theme === 'dark' ? set.dark : set.light} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />;
}

// Every screen using this shared Header gets the theme toggle for free —
// screens with custom header markup (Home, Auth, PublicDashboard) render
// <ThemeToggle/> directly instead.
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
      <ThemeToggle />
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

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button className={`theme-toggle ${isDark ? 'dark' : ''}`} onClick={toggle}
      title="Toggle theme" aria-label="Toggle dark mode">
      <span className="theme-toggle-thumb">
        {isDark ? <Moon size={12} /> : <Sun size={12} />}
      </span>
    </button>
  );
}

// Text input with a live dropdown of previously-added people (deduped by
// participant_id, across every group the current user has access to) so an
// admin can reuse an existing person's profile instead of minting a new one
// every time. `onSelect(member)` fires with { name, participant_id }.
export function MemberAutocomplete({ value, onChange, knownMembers, onSelect, placeholder, onEnter, autoFocus }) {
  const [open, setOpen] = React.useState(false);
  const q = value.trim().toLowerCase();
  const matches = q
    ? (knownMembers || []).filter(m => m.name.toLowerCase().includes(q)).slice(0, 5)
    : [];

  return (
    <div style={{ position: 'relative' }}>
      <input className="input" placeholder={placeholder} value={value} autoFocus={autoFocus}
        autoComplete="off" autoCapitalize="words"
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()} />
      {open && matches.length > 0 && (
        <div className="autocomplete-menu">
          {matches.map(m => (
            <div key={m.participant_id} className="autocomplete-item"
              onMouseDown={() => { onSelect(m); setOpen(false); }}>
              <span className="avatar avatar-xs">{m.name[0]?.toUpperCase() || '?'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
              <span className="autocomplete-hint">Existing</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
