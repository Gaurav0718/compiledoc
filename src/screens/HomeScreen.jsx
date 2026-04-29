import React, { useState, useEffect } from 'react';
import { getVisibleGroups, getSetting } from '../db/database';
import { ThemeToggle, fmt } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { ChevronRight, Calculator } from 'lucide-react';

const TYPE_META = {
  family: { icon: '🏠', label: 'Family Get-together', color: 'var(--accent)' },
  trip:   { icon: '✈️', label: 'Trip Expense Audit',  color: 'var(--blue)' },
};

export default function HomeScreen({ navigate }) {
  const [groups, setGroups] = useState([]);
  const [avatar, setAvatar] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      getVisibleGroups(user).then(setGroups);
      const uid = user.uid || user.user_id || '';
      getSetting(uid, 'avatar', null).then(a => { if (a) setAvatar(a); });
    }
  }, [user]);

  const displayName = user?.displayName || user?.display_name || '';
  const username    = user?.username || user?.user_id || '';

  return (
    <div className="screen">
      <div className="header" style={{ borderBottom: 'none' }}>
        {/* Clickable avatar → Profile */}
        <button onClick={() => navigate('profile')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0 }} title="View Profile">
          {avatar
            ? <img src={avatar} alt="avatar" style={{ width:38, height:38, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--accent)', boxShadow:'0 0 10px var(--accent-glow)' }}/>
            : <div className="avatar avatar-sm">{(displayName[0] || username[0] || '?').toUpperCase()}</div>
          }
        </button>
        <button onClick={() => navigate('profile')} style={{ flex:1, minWidth:0, background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0 }}>
          <div style={{ fontWeight:700, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>
            {displayName || username}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>@{username}</div>
        </button>
        <ThemeToggle />
        <button className="icon-btn" onClick={() => navigate('budget')} title="Budget Calculator">
          <Calculator size={16} style={{ color: 'var(--blue)' }} />
        </button>
      </div>

      <div className="content">
        <div style={{ padding: '8px 0 4px' }}>
          <div style={{ fontWeight: 900, fontSize: 26, letterSpacing: '-0.04em', background: 'var(--grad-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            CompileDoc
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>What are you tracking today?</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mode-card" onClick={() => navigate('create', { type: 'family' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 36, filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.5))' }}>🏠</div>
              <div style={{ flex: 1 }}>
                <div className="mode-card-title">Family Get-together</div>
                <div className="mode-card-desc">Pool contributions, track event expenses, tally live. No equal split.</div>
              </div>
              <div style={{ color: 'var(--accent)', opacity: 0.5 }}><ChevronRight size={18} /></div>
            </div>
          </div>
          <div className="mode-card" onClick={() => navigate('create', { type: 'trip' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 36, filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.5))' }}>✈️</div>
              <div style={{ flex: 1 }}>
                <div className="mode-card-title">Trip Expense Audit</div>
                <div className="mode-card-desc">Log expenses, split fairly, settle debts with min transactions.</div>
              </div>
              <div style={{ color: 'var(--blue)', opacity: 0.5 }}><ChevronRight size={18} /></div>
            </div>
          </div>
        </div>

        {groups.length > 0 && (
          <>
            <div className="divider" style={{ margin: '4px 0' }} />
            <div className="section-title">Your Groups</div>
            {groups.map(g => {
              const meta = TYPE_META[g.type] || TYPE_META.trip;
              return (
                <div key={g.id} className="card-sm"
                  style={{ display:'flex', alignItems:'center', gap:12, background:'var(--surface)', border:'1px solid var(--border)' }}>
                  <div style={{ width:44, height:44, borderRadius:13, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, border:'1px solid var(--border)' }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0, cursor:'pointer' }}
                    onClick={() => navigate(g.type === 'family' ? 'familyDash' : 'dashboard', { groupId: g.id })}>
                    <div style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>
                      {g.name}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                      {meta.label} · {new Date(g.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <button className="btn btn-xs btn-secondary"
                      style={{ fontSize:11, padding:'5px 10px' }}
                      title="Public read-only view"
                      onClick={() => navigate('publicDash', { groupId: g.id })}>
                      👁️ View
                    </button>
                    <button className="btn btn-xs btn-secondary"
                      style={{ fontSize:11, padding:'5px 10px' }}
                      title="Copy shareable link"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/view/${g.id}`;
                        try { await navigator.clipboard.writeText(url); }
                        catch { const el = document.createElement('textarea'); el.value = url; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }
                        const btn = e.currentTarget;
                        btn.textContent = '✓ Copied';
                        setTimeout(() => { btn.textContent = '🔗 Link'; }, 2000);
                      }}>
                      🔗 Link
                    </button>
                    <ChevronRight size={15} style={{ color:'var(--text3)', cursor:'pointer' }}
                      onClick={() => navigate(g.type === 'family' ? 'familyDash' : 'dashboard', { groupId: g.id })} />
                  </div>
                </div>
              );
            })}
          </>
        )}

        {groups.length === 0 && (
          <div className="empty">
            <div className="empty-icon">📂</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text2)', marginBottom: 4 }}>No groups yet</div>
            <div className="empty-text">Choose a type above to create your first group</div>
          </div>
        )}

        <div className="divider" style={{ margin: '4px 0' }} />
        <div style={{ textAlign:'center', fontSize:12, color:'var(--text3)', lineHeight:1.7 }}>
          💾 All data on your device · Offline-first · No cloud
        </div>
      </div>
    </div>
  );
}
