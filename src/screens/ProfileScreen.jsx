import React, { useState, useEffect, useRef } from 'react';
import { getVisibleGroups, resetPin, getSecurityQuestion, setSetting, getSetting, changeUserId } from '../db/database';
import { Header, TypeIcon, fmt, dashRoute } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { sounds } from '../logic/sounds';
import { Delete, Camera, ChevronRight, Shield, LogOut, Users } from 'lucide-react';

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the name of your primary school?",
  "What is your oldest sibling's middle name?",
];

function PinPad({ value, onChange, onComplete, loading }) {
  const handleKey = (k) => {
    if (loading) return;
    if (k === 'del') { onChange(value.slice(0, -1)); setTimeout(sounds.tap, 0); return; }
    if (value.length >= 4) return;
    const next = value + k;
    onChange(next);
    setTimeout(sounds.tap, 0); // deferred so the PIN-dot paint isn't blocked by audio synthesis
    if (next.length === 4) setTimeout(() => onComplete?.(next), 120);
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, alignItems:'center' }}>
      <div style={{ display:'flex', gap:14 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width:16, height:16, borderRadius:'50%',
            border:`2px solid ${value.length > i ? 'var(--accent)' : 'var(--border2)'}`,
            background: value.length > i ? 'var(--accent)' : 'transparent',
            transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
            transform: value.length > i ? 'scale(1.25)' : 'scale(1)',
          }}/>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, width:228 }}>
        {['1','2','3','4','5','6','7','8','9','','0','del'].map((k,i) => (
          <button key={i}
            className={`pin-key${k===''?' empty':k==='del'?' del':''}`}
            style={{ width:68, height:68, fontSize: k==='del'?'inherit':22, borderRadius:'50%' }}
            onClick={() => k !== '' && handleKey(k)}
            disabled={loading || k === ''}
          >
            {k === 'del' ? <Delete size={20}/> : k}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProfileScreen({ navigate }) {
  const { user, login, logout } = useAuth();
  const fileRef = useRef();

  const [groups, setGroups]         = useState([]);
  const [sheet, setSheet]           = useState(null); // 'pin' | 'photo' | 'userid'

  // Change User ID state
  const [newUserId, setNewUserId]   = useState('');
  const [idVerifyPin, setIdVerifyPin] = useState('');
  const [idPinStep, setIdPinStep]   = useState('form'); // 'form' | 'pin'
  const [idError, setIdError]       = useState('');
  const [idSuccess, setIdSuccess]   = useState('');
  const [avatar, setAvatar]         = useState(null);

  // PIN change state
  const [pinStep, setPinStep]       = useState('verify'); // 'verify'|'new'|'confirm'
  const [secQuestion, setSecQuestion] = useState('');
  const [secAnswer, setSecAnswer]   = useState('');
  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError]     = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);

  const uid = user?.uid || user?.user_id || '';

  useEffect(() => {
    if (user) {
      getVisibleGroups(user).then(setGroups);
      getSetting(uid, 'avatar', null).then(a => { if (a) setAvatar(a); });
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target.result;
      setAvatar(data);
      await setSetting(uid, 'avatar', data);
      sounds.success();
      setSheet(null);
    };
    reader.readAsDataURL(file);
  };

  const openPinSheet = async () => {
    setPinStep('verify');
    setSecAnswer(''); setNewPin(''); setConfirmPin('');
    setPinError(''); setPinSuccess(false);
    try {
      const q = await getSecurityQuestion(uid);
      setSecQuestion(q);
    } catch { setSecQuestion(''); }
    setSheet('pin');
  };

  const handleVerify = () => {
    if (!secAnswer.trim()) { setPinError('Enter your security answer'); return; }
    setPinError(''); setPinStep('new');
  };

  const handleNewPin = (p) => { setNewPin(p); setPinStep('confirm'); };

  const handleConfirmPin = async (p) => {
    if (newPin !== p) {
      sounds.error(); setPinError('PINs do not match');
      setConfirmPin(''); setPinStep('new'); setNewPin('');
      return;
    }
    setPinLoading(true);
    try {
      await resetPin({ username: uid, securityAnswer: secAnswer, newPin: p });
      // Update session with new PIN
      login({ ...user });
      sounds.success();
      setPinSuccess(true);
      setTimeout(() => setSheet(null), 1500);
    } catch(e) {
      sounds.error(); setPinError(e.message);
      setPinStep('verify');
    } finally { setPinLoading(false); }
  };

  const handleLogout = () => {
    sounds.nav();
    logout();
  };

  if (!user) return null;

  const displayName = user.displayName || user.display_name || uid;
  const username    = user.username || user.user_id || uid;

  const TYPE_META = {
    family:    { label: 'Family Get-together', chip: 'family' },
    trip:      { label: 'Trip Expense Audit',  chip: 'trip' },
    splitwise: { label: 'Split Expenses',      chip: 'splitwise' },
  };

  return (
    <div className="screen">
      <Header title="Profile" onBack={() => navigate('home')} />
      <div className="content">

        {/* ── AVATAR + NAME ── */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0 8px', gap:12 }}>
          <div style={{ position:'relative', cursor:'pointer' }} onClick={() => setSheet('photo')}>
            {avatar
              ? <img src={avatar} alt="avatar" style={{ width:88, height:88, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--accent)', boxShadow:'0 0 20px var(--accent-glow)' }}/>
              : (
                <div style={{ width:88, height:88, borderRadius:'50%', background:'var(--grad-main)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, fontWeight:700, color:'#fff', boxShadow:'0 0 20px var(--accent-glow)' }}>
                  {displayName[0]?.toUpperCase() || '?'}
                </div>
              )
            }
            <div style={{ position:'absolute', bottom:2, right:2, width:26, height:26, borderRadius:'50%', background:'var(--surface)', border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
              <Camera size={13} style={{ color:'var(--accent)' }}/>
            </div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:600, fontSize:20, letterSpacing:'-0.01em', color:'var(--text)' }}>{displayName}</div>
            <div style={{ fontSize:13, color:'var(--text3)', marginTop:3, fontFamily:'monospace' }}>@{username}</div>
          </div>
        </div>

        {/* ── ACCOUNT ── */}
        <div className="section-title">Account</div>
        <div className="card" style={{ padding:'4px 0' }}>
          {[
            {
              icon: <Shield size={16} style={{ color:'var(--accent)' }}/>,
              label: 'Change PIN',
              sub: 'Update your 4-digit login PIN',
              action: openPinSheet,
            },
            {
              icon: <span style={{ fontSize:16, lineHeight:1 }}>🪪</span>,
              label: 'Change User ID',
              sub: `Current: @${username}`,
              action: () => { setNewUserId(''); setIdError(''); setIdSuccess(''); setIdPinStep('form'); setIdVerifyPin(''); setSheet('userid'); },
            },
          ].map((item, i, arr) => (
            <button key={i} onClick={item.action}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'14px 18px', background:'none', border:'none', cursor:'pointer', textAlign:'left', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width:36, height:36, borderRadius:0, background:'var(--surface2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {item.icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{item.label}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{item.sub}</div>
              </div>
              <ChevronRight size={15} style={{ color:'var(--text3)' }}/>
            </button>
          ))}
        </div>

        {/* ── MY GROUPS ── */}
        <div className="section-title">My Groups ({groups.length})</div>
        {groups.length === 0 && (
          <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text3)', fontSize:13 }}>
            No groups yet
          </div>
        )}
        {groups.map(g => {
          const meta = TYPE_META[g.type] || TYPE_META.trip;
          return (
            <button key={g.id} className="card-sm"
              style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', width:'100%', textAlign:'left' }}
              onClick={() => navigate(dashRoute(g.type), { groupId: g.id })}>
              <div className={`type-chip type-chip-xs ${meta.chip}`}>
                <TypeIcon type={g.type} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>
                  {g.name}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                  {meta.label}
                </div>
              </div>
              <ChevronRight size={14} style={{ color:'var(--text3)', flexShrink:0 }}/>
            </button>
          );
        })}

        {/* ── LOGOUT ── */}
        <div style={{ marginTop:8 }}>
          <button className="btn btn-danger" onClick={handleLogout} style={{ fontSize:14, fontWeight:600 }}>
            <LogOut size={16}/> Sign Out
          </button>
        </div>

        <div style={{ textAlign:'center', fontSize:11, color:'var(--text3)', paddingBottom:8, lineHeight:1.6 }}>
          CompileDoc · All data stored locally<br/>Works offline
        </div>
      </div>

      {/* ── PHOTO BOTTOM SHEET ── */}
      {sheet === 'photo' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setSheet(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-title">Profile Photo</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                <Camera size={16}/> Upload Photo
              </button>
              {avatar && (
                <button className="btn btn-danger" onClick={async () => {
                  setAvatar(null);
                  await setSetting(uid, 'avatar', null);
                  setSheet(null);
                }}>
                  Remove Photo
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setSheet(null)}>Cancel</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarChange}/>
          </div>
        </div>
      )}

      {/* ── CHANGE PIN BOTTOM SHEET ── */}
      {sheet === 'pin' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setSheet(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-title">
              {pinSuccess ? '✓ PIN Updated!' : pinStep === 'verify' ? 'Verify Identity' : pinStep === 'new' ? 'New PIN' : 'Confirm PIN'}
            </div>

            {pinSuccess ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'var(--green)', fontSize:16, fontWeight:600 }}>
                Your PIN has been updated successfully.
              </div>
            ) : pinStep === 'verify' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {secQuestion && (
                  <div className="card" style={{ background:'var(--accent-bg)', borderColor:'var(--accent)', fontSize:13, color:'var(--text2)' }}>
                    <div style={{ fontWeight:600, color:'var(--accent)', marginBottom:5 }}>Security Question</div>
                    {secQuestion}
                  </div>
                )}
                <div className="input-group">
                  <div className="input-label">Your Answer</div>
                  <input className="input" placeholder="Case-insensitive" value={secAnswer}
                    onChange={e => { setSecAnswer(e.target.value); setPinError(''); }} autoFocus/>
                </div>
                {pinError && <div style={{ fontSize:13, color:'var(--red)', background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:0, padding:'9px 14px', textAlign:'center' }}>{pinError}</div>}
                <button className="btn btn-primary" disabled={!secAnswer.trim()} onClick={handleVerify}>Continue →</button>
                <button className="btn btn-ghost btn-sm" style={{ margin:'0 auto', width:'auto' }} onClick={() => setSheet(null)}>Cancel</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:16, alignItems:'center' }}>
                <div style={{ fontSize:13, color:'var(--text2)', textAlign:'center' }}>
                  {pinStep === 'new' ? 'Enter your new 4-digit PIN' : 'Re-enter to confirm'}
                </div>
                <PinPad
                  value={pinStep === 'new' ? newPin : confirmPin}
                  onChange={pinStep === 'new' ? setNewPin : setConfirmPin}
                  loading={pinLoading}
                  onComplete={pinStep === 'new' ? handleNewPin : handleConfirmPin}
                />
                {pinError && <div style={{ fontSize:13, color:'var(--red)', background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:0, padding:'9px 14px', textAlign:'center', width:'100%' }}>{pinError}</div>}
                <button className="btn btn-ghost btn-sm" style={{ margin:'0 auto', width:'auto' }}
                  onClick={() => { setSheet(null); setNewPin(''); setConfirmPin(''); setPinStep('verify'); }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHANGE USER ID BOTTOM SHEET ── */}
      {sheet === 'userid' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setSheet(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-title">Change User ID</div>
            {idSuccess ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
                <div style={{ fontWeight:700, color:'var(--green)', fontSize:16 }}>User ID Updated!</div>
                <div style={{ fontSize:13, color:'var(--text2)', marginTop:8, fontFamily:'monospace' }}>New ID: @{idSuccess}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:6, lineHeight:1.5 }}>Updated across all your groups.</div>
              </div>
            ) : idPinStep === 'form' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ fontSize:13, color:'var(--text2)', background:'var(--blue-bg)', border:'1px solid var(--blue)', borderRadius:0, padding:'10px 14px', lineHeight:1.5 }}>
                  <strong style={{ color:'var(--blue)' }}>ℹ️ Important</strong><br/>
                  This updates your login ID everywhere across all your groups.
                </div>
                <div className="input-group">
                  <div className="input-label">New User ID</div>
                  <input className="input" placeholder="lowercase, letters/numbers/_ only"
                    value={newUserId} autoCapitalize="none" autoCorrect="off" autoFocus
                    onChange={e => { setNewUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'')); setIdError(''); }}/>
                  {newUserId.length > 0 && (
                    <div style={{ fontSize:11, color: newUserId.length >= 4 ? 'var(--green)' : 'var(--red)' }}>
                      {newUserId.length >= 4 ? `✓ @${newUserId}` : `Need at least 4 characters (${newUserId.length}/4)`}
                    </div>
                  )}
                </div>
                {idError && <div style={{ fontSize:13, color:'var(--red)', background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:0, padding:'9px 14px' }}>{idError}</div>}
                <button className="btn btn-primary" disabled={newUserId.length < 4}
                  onClick={() => { setIdPinStep('pin'); setIdError(''); }}>
                  Continue → Verify with PIN
                </button>
                <button className="btn btn-ghost btn-sm" style={{ margin:'0 auto', width:'auto' }} onClick={() => setSheet(null)}>Cancel</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:16, alignItems:'center' }}>
                <div style={{ fontSize:13, color:'var(--text2)', textAlign:'center' }}>
                  Enter your current PIN to confirm change to <strong>@{newUserId}</strong>
                </div>
                <PinPad value={idVerifyPin} onChange={setIdVerifyPin} loading={pinLoading}
                  onComplete={async (p) => {
                    setPinLoading(true);
                    try {
                      const updated = await changeUserId({ oldUserId: uid, newUserId, pin: p });
                      login({ ...user, user_id: updated, uid: updated, username: updated, participant_id: updated });
                      sounds.success(); setIdSuccess(updated);
                    } catch(e) {
                      sounds.error(); setIdError(e.message);
                      setIdVerifyPin(''); setIdPinStep('form');
                    } finally { setPinLoading(false); }
                  }}
                />
                {idError && <div style={{ fontSize:13, color:'var(--red)', background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:0, padding:'9px 14px', width:'100%', textAlign:'center' }}>{idError}</div>}
                <button className="btn btn-ghost btn-sm" style={{ margin:'0 auto', width:'auto' }}
                  onClick={() => { setIdPinStep('form'); setIdVerifyPin(''); setIdError(''); }}>← Back</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
