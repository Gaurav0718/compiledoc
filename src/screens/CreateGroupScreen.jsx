import React, { useState } from 'react';
import { createGroup, addMember } from '../db/database';
import { Header, dashRoute } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { sounds } from '../logic/sounds';
import { Plus, X } from 'lucide-react';

export default function CreateGroupScreen({ navigate, params }) {
  const type        = params?.type || 'family';
  const isFamily    = type === 'family';
  const isSplitwise = type === 'splitwise';
  const skipModeStep = isFamily || isSplitwise; // no equal/audit choice for these two types
  const { user } = useAuth();

  const [step, setStep]     = useState(0);
  const [name, setName]     = useState('');
  const [mode, setMode]     = useState('audit');
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const totalSteps = skipModeStep ? 2 : 3;

  const addLocal = () => {
    const t = newMember.trim();
    if (!t) return;
    if (members.includes(t)) { setError('Already added'); return; }
    setMembers([...members, t]);
    setNewMember('');
    setError('');
    sounds.pop();
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const groupId = await createGroup({ uid: user.uid, name: name.trim(), type, mode: isFamily ? 'family' : isSplitwise ? 'splitwise' : mode, creatorName: user.displayName });
      for (const m of members) await addMember(groupId, user.uid, m, 'member', user.displayName);
      sounds.success();
      navigate(dashRoute(type), { groupId });
    } catch {
      setError('Failed to create. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    // ── Step 0: Name
    <div className="content" key="s0">
      <div style={{ padding: '8px 0 4px' }}>
        <div style={{ fontWeight: 600, fontSize: 24, letterSpacing: '-0.01em', marginBottom: 6 }}>
          {isFamily ? '🎉 Name your event' : isSplitwise ? '💸 Name your group' : '✈️ Name your trip'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {isFamily ? 'e.g. Diwali 2025, Annual Family Reunion' : isSplitwise ? 'e.g. Flatmates, Goa Squad, Office Lunch' : 'e.g. Goa 2025, Office Trip'}
        </div>
      </div>
      <input
        className="input"
        style={{ fontSize: 20, fontWeight: 700, padding: '16px 18px' }}
        placeholder={isFamily ? 'Diwali 2025 🪔' : isSplitwise ? 'Flatmates 🏡' : 'Goa Trip 🏖️'}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(1)}
        autoFocus
      />
      <button className="btn btn-primary" disabled={!name.trim()} style={{ opacity: name.trim() ? 1 : 0.4 }}
        onClick={() => { if (name.trim()) { sounds.nav(); setStep(1); } }}>
        Continue →
      </button>
    </div>,

    // ── Step 1 (Family/Splitwise): Members | Step 1 (Trip): Mode
    skipModeStep ? (
      <div className="content" key="s1f">
        <div style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.01em', marginBottom: 4 }}>
          {isSplitwise ? 'Add Members' : 'Add Participants'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
          {isSplitwise ? 'Add everyone in the group — you can add more later.' : "Optional — you can add more later. Contributors don't need to be pre-registered."}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder={isSplitwise ? 'Member name' : 'Participant name'} value={newMember}
            onChange={e => { setNewMember(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && addLocal()} autoFocus />
          <button className="btn btn-primary btn-icon" onClick={addLocal}><Plus size={18} /></button>
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
        {members.map((m, i) => (
          <div key={i} className="member-item" style={{ cursor: 'default' }}>
            <div className="avatar avatar-sm">{m[0].toUpperCase()}</div>
            <div style={{ flex: 1, fontWeight: 600 }}>{m}</div>
            <button onClick={() => setMembers(members.filter((_,j)=>j!==i))} style={{ background:'none',border:'none',color:'var(--red)',cursor:'pointer',display:'flex',alignItems:'center',padding:4,borderRadius:8 }}>
              <X size={16} />
            </button>
          </div>
        ))}
        {error && <div style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center' }}>{error}</div>}
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating…' : isSplitwise ? `💸 Create ${name}` : `🎉 Create ${name}`}
        </button>
      </div>
    ) : (
      <div className="content" key="s1t">
        <div style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.01em', marginBottom: 4 }}>Split Mode</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { val:'equal', icon:'⚖️', title:'Equal Split', desc:'Expenses divided equally among participants' },
            { val:'audit', icon:'🔍', title:'Collect & Audit', desc:'Collect upfront, track all spending, settle at end' },
          ].map(m => (
            <div key={m.val} className={`mode-card ${mode===m.val?'selected':''}`} style={{ padding: 16 }} onClick={() => setMode(m.val)}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:28 }}>{m.icon}</span>
                <div><div style={{ fontWeight:700, marginBottom:3 }}>{m.title}</div><div style={{ fontSize:12, color:'var(--text2)' }}>{m.desc}</div></div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => { sounds.nav(); setStep(2); }}>Continue →</button>
      </div>
    ),

    // ── Step 2 (Trip only): Members
    !skipModeStep ? (
      <div className="content" key="s2t">
        <div style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.01em', marginBottom: 4 }}>Who's coming?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Member name" value={newMember}
            onChange={e => { setNewMember(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && addLocal()} autoFocus />
          <button className="btn btn-primary btn-icon" onClick={addLocal}><Plus size={18} /></button>
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
        {members.map((m, i) => (
          <div key={i} className="member-item" style={{ cursor: 'default' }}>
            <div className="avatar avatar-sm">{m[0].toUpperCase()}</div>
            <div style={{ flex: 1, fontWeight: 600 }}>{m}</div>
            <button onClick={() => setMembers(members.filter((_,j)=>j!==i))} style={{ background:'none',border:'none',color:'var(--red)',cursor:'pointer',display:'flex',alignItems:'center',padding:4,borderRadius:8 }}>
              <X size={16} />
            </button>
          </div>
        ))}
        {error && <div style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center' }}>{error}</div>}
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating…' : '✈️ Create Trip'}
        </button>
      </div>
    ) : null,
  ].filter(Boolean);

  return (
    <div className="screen">
      <Header title={isFamily ? 'New Event' : isSplitwise ? 'New Split Group' : 'New Trip'} subtitle={`Step ${step+1} of ${totalSteps}`}
        onBack={() => step > 0 ? setStep(step-1) : navigate('home')} />
      <div className="steps">
        {Array.from({ length: totalSteps }, (_,i) => (
          <div key={i} className={`step-dot ${i<step?'done':i===step?'active':''}`} />
        ))}
      </div>
      {steps[step]}
    </div>
  );
}
