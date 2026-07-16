import React, { useState, useEffect } from 'react';
import { getGroupData, addMember, removeMember, updateMemberRole, updateGroupName, checkIsAdmin, deleteGroup, updateMemberName, getKnownMembers } from '../db/database';
import { Header, dashRoute, MemberAutocomplete } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { sounds } from '../logic/sounds';
import { Plus, Trash2, ShieldCheck, ShieldOff, Edit3, Copy, Check } from 'lucide-react';

export default function AdminPanelScreen({ navigate, groupId }) {
  const { user } = useAuth();
  const [data, setData]         = useState(null);
  const [newName, setNewName]   = useState('');
  const [newParticipantId, setNewParticipantId] = useState(null);
  const [knownMembers, setKnownMembers] = useState([]);
  const [newRole, setNewRole]   = useState('member');
  const [editingName, setEditingName] = useState(false);
  const [groupNameEdit, setGroupNameEdit] = useState('');
  const [error, setError]       = useState('');
  const [isAdmin, setIsAdmin]   = useState(false);
  const [lastAdded, setLastAdded] = useState(null); // {name, participant_id}
  const [copied, setCopied]     = useState(false);

  useEffect(() => { load(); }, [groupId]);
  useEffect(() => { if (user) getKnownMembers(user).then(setKnownMembers); }, [user]);

  const load = async () => {
    const d = await getGroupData(groupId);
    // Fix: if creator member record has name = owner_id (raw user_id), 
    // update it to the proper display name now that we know who they are
    if (d.group && user) {
      const ownerUid = d.group.owner_id;
      const creatorMember = d.members.find(m =>
        m.participant_id === ownerUid && m.name === ownerUid
      );
      if (creatorMember && user.displayName && user.uid === ownerUid) {
        await updateMemberName(creatorMember.id, user.displayName);
        creatorMember.name = user.displayName; // update in-place for UI
      }
    }
    setData(d);
    setGroupNameEdit(d.group?.name || '');
    setIsAdmin(await checkIsAdmin(groupId, user));
  };

  const handleAddMember = async () => {
    const t = newName.trim();
    if (!t) return;
    if (data.members.find(m => m.name.toLowerCase() === t.toLowerCase())) { setError('Name already exists'); return; }
    const result = await addMember(groupId, user.uid, t, newRole, user.displayName, newParticipantId);
    sounds.success();
    setLastAdded({ name: t, participant_id: result.participant_id, role: newRole, reused: !!newParticipantId });
    setNewName(''); setNewParticipantId(null); setError('');
    load();
    if (user) getKnownMembers(user).then(setKnownMembers);
  };

  const handleRemove = async (m) => {
    if (!confirm(`Remove ${m.name}?`)) return;
    await removeMember(m.id, groupId, user.uid, user.displayName);
    sounds.delete(); load();
  };

  const handleToggleRole = async (m) => {
    const role = m.role === 'admin' ? 'member' : 'admin';
    await updateMemberRole(m.id, groupId, user.uid, role, user.displayName);
    sounds.nav(); load();
  };

  const handleRenameGroup = async () => {
    if (!groupNameEdit.trim()) return;
    await updateGroupName(groupId, groupNameEdit.trim(), user.displayName, user.uid);
    sounds.success(); setEditingName(false); load();
  };

  const copyPid = (pid) => {
    navigator.clipboard?.writeText(pid).catch(()=>{});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    sounds.tap();
  };

  if (!data) return <div className="screen"><div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)'}}>Loading…</div></div>;

  const admins  = data.members.filter(m => m.role === 'admin');
  const viewers = data.members.filter(m => m.role !== 'admin');

  return (
    <div className="screen">
      <Header title="Admin Panel" subtitle={data.group?.name}
        onBack={() => navigate(dashRoute(data?.group?.type), { groupId })}
        right={<span style={{fontSize:11,color:'var(--accent)',fontWeight:600,background:'var(--accent-bg)',padding:'4px 10px',borderRadius:0,border:'1px solid var(--accent)'}}>🛡️ Admin</span>}
      />
      <div className="content">

        {/* GROUP NAME */}
        <div className="section-title">Group Settings</div>
        <div className="card">
          <div style={{fontSize:11,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600}}>Group Name</div>
          {editingName ? (
            <div style={{display:'flex',gap:8}}>
              <input className="input" value={groupNameEdit} onChange={e=>setGroupNameEdit(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleRenameGroup()} autoFocus style={{flex:1}}/>
              <button className="btn btn-primary btn-sm" onClick={handleRenameGroup}>Save</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setEditingName(false)}>✕</button>
            </div>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,fontWeight:700,fontSize:16,color:'var(--text)'}}>{data.group?.name}</div>
              {isAdmin && <button className="icon-btn" onClick={()=>setEditingName(true)}><Edit3 size={14}/></button>}
            </div>
          )}
        </div>

        {/* LAST ADDED — show participant ID prominently */}
        {lastAdded && (
          <div className="card" style={{background:'var(--green-bg)',borderColor:'var(--green)'}}>
            <div style={{fontSize:12,color:'var(--green)',fontWeight:700,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.07em'}}>
              ✓ {lastAdded.name} added as {lastAdded.role}
            </div>
            <div style={{fontSize:13,color:'var(--text2)',marginBottom:10,lineHeight:1.5}}>
              {lastAdded.reused
                ? <>This is an existing person — they can already sign in with their <strong>Participant ID</strong> below and will now see this group too.</>
                : <>Share this <strong>Participant ID</strong> with them so they can set up their account:</>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--surface3)',borderRadius:0,padding:'10px 14px',cursor:'pointer'}}
              onClick={() => copyPid(lastAdded.participant_id)}>
              <code style={{flex:1,fontFamily:'monospace',fontSize:18,fontWeight:700,color:'var(--accent)',letterSpacing:'0.04em'}}>
                {lastAdded.participant_id}
              </code>
              {copied ? <Check size={18} style={{color:'var(--green)'}}/> : <Copy size={16} style={{color:'var(--text3)'}}/>}
            </div>
            {!lastAdded.reused && (
              <div style={{fontSize:11,color:'var(--text3)',marginTop:8}}>
                They use this ID + set their own PIN on first login → <em>Sign In → New Participant</em>
              </div>
            )}
          </div>
        )}

        {/* ADMINS */}
        <div className="section-title">Admins ({admins.length})</div>
        <div className="card" style={{padding:'4px 18px'}}>
          {admins.map(m => (
            <div key={m.id} className="admin-row">
              <div className="avatar avatar-sm" style={{background:'var(--grad-main)'}}>{m.name[0].toUpperCase()}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{m.name}</div>
                <div style={{fontSize:11,display:'flex',gap:6,alignItems:'center',marginTop:2}}>
                  <span style={{color:'var(--accent)'}}>🛡️ Admin</span>
                  {m.participant_id && (
                    <span style={{color:'var(--text3)',fontFamily:'monospace',fontSize:10,background:'var(--surface3)',padding:'1px 6px',borderRadius:0,cursor:'pointer'}}
                      onClick={()=>copyPid(m.participant_id)} title="Copy ID">
                      {m.participant_id}
                    </span>
                  )}
                </div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                {(m.participant_id || '').toLowerCase().trim() === (user?.uid || user?.participant_id || user?.user_id || '').toLowerCase().trim()
                  ? <span style={{fontSize:11,color:'var(--text3)',fontStyle:'italic'}}>You</span>
                  : isAdmin && (
                    <>
                      <button className="action-btn" style={{color:'var(--orange)'}} title="Revoke admin" onClick={()=>handleToggleRole(m)}><ShieldOff size={15}/></button>
                      <button className="action-btn del" onClick={()=>handleRemove(m)}><Trash2 size={14}/></button>
                    </>
                  )
                }
              </div>
            </div>
          ))}
          {admins.length === 0 && <div style={{padding:'14px 0',fontSize:13,color:'var(--text3)'}}>No admins yet</div>}
        </div>

        {/* MEMBERS */}
        <div className="section-title">Members ({viewers.length})</div>
        <div className="card" style={{padding:'4px 18px'}}>
          {viewers.map(m => (
            <div key={m.id} className="admin-row">
              <div className="avatar avatar-sm">{m.name[0].toUpperCase()}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{m.name}</div>
                <div style={{fontSize:11,display:'flex',gap:6,alignItems:'center',marginTop:2}}>
                  <span style={{color:'var(--text3)'}}>👁️ Viewer</span>
                  {m.participant_id && (
                    <span style={{color:'var(--text3)',fontFamily:'monospace',fontSize:10,background:'var(--surface3)',padding:'1px 6px',borderRadius:0,cursor:'pointer'}}
                      onClick={()=>copyPid(m.participant_id)} title="Copy ID">
                      {m.participant_id}
                    </span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div style={{display:'flex',gap:6}}>
                  <button className="action-btn" style={{color:'var(--accent)'}} title="Make admin" onClick={()=>handleToggleRole(m)}><ShieldCheck size={15}/></button>
                  <button className="action-btn del" onClick={()=>handleRemove(m)}><Trash2 size={14}/></button>
                </div>
              )}
            </div>
          ))}
          {viewers.length === 0 && <div style={{padding:'14px 0',fontSize:13,color:'var(--text3)'}}>All members are admins</div>}
        </div>

        {/* ADD MEMBER */}
        {isAdmin && (
          <>
            <div className="section-title">Add New Member</div>
            <div className="card">
              <div className="input-group">
                <MemberAutocomplete value={newName}
                  onChange={v => { setNewName(v); setNewParticipantId(null); setError(''); }}
                  knownMembers={knownMembers}
                  onSelect={m => { setNewName(m.name); setNewParticipantId(m.participant_id); setError(''); }}
                  onEnter={handleAddMember}
                  placeholder="Member name" />
              </div>
              <div style={{display:'flex',gap:8,margin:'10px 0'}}>
                {['member','admin'].map(r => (
                  <button key={r} className={`filter-chip ${newRole===r?'active':''}`} onClick={()=>setNewRole(r)}>
                    {r==='admin'?'🛡️ Admin':'👁️ Viewer'}
                  </button>
                ))}
              </div>
              {error && <div style={{fontSize:12,color:'var(--red)',marginBottom:8}}>{error}</div>}
              <button className="btn btn-primary" onClick={handleAddMember} disabled={!newName.trim()}>
                <Plus size={16}/> Add {newRole==='admin'?'Admin':'Member'}
              </button>
              <div style={{fontSize:12,color:'var(--text3)',marginTop:10,lineHeight:1.6}}>
                After adding, a <strong>Participant ID</strong> will be shown above. Share it with them — they use it to create their account via <em>Sign In → New Participant</em>.
              </div>
            </div>
          </>
        )}

        <div className="card" style={{background:'var(--accent-bg)',borderColor:'var(--accent)',fontSize:13,color:'var(--text2)',lineHeight:1.6}}>
          <strong style={{color:'var(--accent)'}}>How access works:</strong><br/>
          🛡️ <strong>Admin</strong> — add/edit/delete, manage members<br/>
          👁️ <strong>Viewer</strong> — read-only, export reports<br/><br/>
          New admins use their <strong>Participant ID</strong> to set up their own account with a personal PIN.
        </div>

        {/* ── DELETE GROUP ── */}
        {isAdmin && (
          <>
            <div style={{ height:1, background:'var(--border)', margin:'8px 0' }}/>
            <div className="section-title" style={{ color:'var(--red)' }}>Danger Zone</div>
            <button className="btn btn-danger"
              onClick={async () => {
                const confirmed = window.confirm(
                  `Delete "${data.group?.name}"?\n\nThis will permanently delete:\n• All ${data.collections.length} collections\n• All ${data.expenses.length} expenses\n• All members and logs\n\nThis cannot be undone.`
                );
                if (!confirmed) return;
                // Double-confirm for groups with data
                if (data.collections.length > 0 || data.expenses.length > 0) {
                  const reconfirmed = window.confirm(
                    `Are you absolutely sure?\n\n"${data.group?.name}" has ${data.collections.length + data.expenses.length} entries that will be lost forever.`
                  );
                  if (!reconfirmed) return;
                }
                sounds.delete();
                await deleteGroup(data.group.group_id, user.uid);
                navigate('home');
              }}
              style={{ fontSize:14 }}
            >
              <Trash2 size={16}/> Delete This Group
            </button>
            <div style={{ fontSize:12, color:'var(--text3)', textAlign:'center', marginTop:-4 }}>
              Permanently deletes all data. Cannot be undone.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
