// ── COLLECTION LIST ───────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { getGroupData, getGroupData as getGroupDataStatic, getAuditLogs as getAuditLogsStatic, getGroup as getGroupStatic, addCollection, updateCollection, deleteCollection, addExpense, updateExpense, deleteExpense, checkIsAdmin } from '../db/database';
import { getFamilyTally, getCategoryTotals, calculateBalances, calculateSettlements } from '../logic/calculations';
import { exportXLSX, exportPDF } from '../logic/export';
import { Header, PaymentBadge, fmt, fmtDate, EmptyState, dashRoute } from '../components/ui';
import TransactionForm from '../components/TransactionForm';
import { useAuth } from '../hooks/useAuth';
import { sounds } from '../logic/sounds';
import { Pencil, Trash2, Download, Camera } from 'lucide-react';

const CAT_ICON = {'Venue':'🏛️','Catering':'🍽️','Decoration':'🎀','Sound & Lighting':'🎵','Videography':'🎬','Photography':'📷','Gifts':'🎁','Transport':'🚗','Invitations':'📬','Sweets & Snacks':'🍬','Pooja Items':'🪔','DJ / Music':'🎧','Flowers':'🌸','Clothing':'👗','Miscellaneous':'📦','Food':'🍽️','Hotel':'🏨','Activities':'🎯','Shopping':'🛍️','Medical':'💊','Fuel':'⛽','Other':'📌'};

function EntryCard({ e, isCollection, isAdmin, onEdit, onDelete, memberMap }) {
  const [showProof, setShowProof] = useState(false);
  return (
    <div className="entry-item">
      <div className="entry-icon" style={isCollection ? { background:'var(--green-bg)', borderColor:'var(--green)' } : {}}>
        {isCollection ? '💰' : (CAT_ICON[e.category]||'📌')}
      </div>
      <div className="entry-body">
        <div className="entry-title">{isCollection ? e.member_name : (e.notes||e.category)}</div>
        <div className="entry-meta">
          <PaymentBadge mode={e.payment_mode} />
          {!isCollection && <span>{e.category}</span>}
          {e.notes && !isCollection && <span style={{ color:'var(--text3)' }}>{e.notes}</span>}
          <span>{fmtDate(e.date)}</span>
          {e.proof_image && (
            <span style={{ cursor:'pointer', color:'var(--blue)', fontSize:10, fontWeight:600 }}
              onClick={() => setShowProof(true)}>📎 Proof</span>
          )}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div className={`entry-amount ${isCollection?'text-green':'text-accent'}`}>{fmt(e.amount)}</div>
        {isAdmin && (
          <>
            <button className="action-btn edit" onClick={onEdit}><Pencil size={13}/></button>
            <button className="action-btn del"  onClick={onDelete}><Trash2 size={13}/></button>
          </>
        )}
      </div>
      {showProof && e.proof_image && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowProof(false)}>
          <img src={e.proof_image} alt="proof" style={{ maxWidth:'100%', maxHeight:'90dvh', borderRadius:0, objectFit:'contain' }} />
        </div>
      )}
    </div>
  );
}

export function CollectionListScreen({ navigate, groupId }) {
  const { user } = useAuth();
  const [data, setData]     = useState(null);
  const [sheet, setSheet]   = useState(null);
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { load(); }, [groupId]);
  const load = async () => {
    const d = await getGroupData(groupId);
    setData(d);
    const admin = await checkIsAdmin(groupId, user);
    setIsAdmin(admin);
  };

  const handleSave = async (vals) => {
    if (sheet?.item) await updateCollection({ id:sheet.item.id, group_id:groupId, uid:user.uid, by:user.displayName, ...vals });
    else await addCollection({ group_id:groupId, uid:user.uid, by:user.displayName, ...vals });
    sounds.success(); setSheet(null); load();
  };
  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return;
    await deleteCollection(id, groupId, user.uid, user.displayName);
    sounds.delete(); load();
  };

  if (!data) return <div className="screen"><div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)' }}>Loading…</div></div>;

  const { collections, group, members } = data;
  const filtered = search ? collections.filter(c => c.member_name.toLowerCase().includes(search.toLowerCase())||(c.notes||'').toLowerCase().includes(search.toLowerCase())) : collections;
  const total = collections.reduce((s,c)=>s+c.amount,0);
  const tally = getFamilyTally(collections, data.expenses);

  return (
    <div className="screen">
      <Header title="Collections" subtitle={`${collections.length} entries · ${fmt(total)}`}
        onBack={() => navigate(dashRoute(group?.type), { groupId })}
        right={<button className="icon-btn glow-b" onClick={() => exportXLSX(group.name, collections, data.expenses, tally, members)}><Download size={15}/></button>}
      />
      <div className="content">
        <input className="input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
        <div className="card" style={{ background:'var(--green-bg)', borderColor:'var(--green)', padding:'14px 18px' }}>
          <div className="flex-between">
            <span style={{ fontSize:13, color:'var(--text2)' }}>Total Collected</span>
            <span style={{ fontWeight:700, fontSize:22, color:'var(--green)', letterSpacing:'-0.03em' }}>{fmt(total)}</span>
          </div>
          <div className="flex-between" style={{ marginTop:6 }}>
            <span style={{ fontSize:12, color:'var(--text3)' }}>Contributors: {new Set(collections.map(c=>c.member_name)).size}</span>
            <span style={{ fontSize:12, color:'var(--text3)' }}>Avg: {collections.length>0?fmt(total/collections.length):'₹0'}</span>
          </div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setSheet('new')}>+ Add Collection</button>
        )}
        {filtered.length===0 && <EmptyState icon="💰" title="No collections yet" sub="Add a collection when someone contributes" />}
        {filtered.map(c => (
          <EntryCard key={c.id} e={c} isCollection={true} isAdmin={isAdmin}
            onEdit={() => setSheet({ item:c })}
            onDelete={() => handleDelete(c.id)}
          />
        ))}
      </div>
      {sheet && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSheet(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-title">{sheet?.item ? 'Edit Collection' : '+ Add Collection'}</div>
            <TransactionForm type="collection" groupType={group?.type} members={members}
              initial={sheet?.item} onSave={handleSave} onCancel={() => setSheet(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ExpenseListScreen({ navigate, groupId }) {
  const { user } = useAuth();
  const [data, setData]     = useState(null);
  const [sheet, setSheet]   = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { load(); }, [groupId]);
  const load = async () => {
    const d = await getGroupData(groupId);
    setData(d);
    const admin = await checkIsAdmin(groupId, user);
    setIsAdmin(admin);
  };

  const handleSave = async (vals) => {
    if (sheet?.item) await updateExpense({ id:sheet.item.id, group_id:groupId, uid:user.uid, by:user.displayName, ...vals });
    else await addExpense({ group_id:groupId, uid:user.uid, by:user.displayName, ...vals });
    sounds.success(); setSheet(null); load();
  };
  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return;
    await deleteExpense(id, groupId, user.uid, user.displayName);
    sounds.delete(); load();
  };

  if (!data) return <div className="screen"><div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)' }}>Loading…</div></div>;

  const { expenses, group, members } = data;
  const memberMap = {}; members.forEach(m=>memberMap[m.id]=m.name);
  const cats = ['All', ...new Set(expenses.map(e=>e.category))];
  let filtered = filter==='All' ? expenses : expenses.filter(e=>e.category===filter);
  if (search) filtered = filtered.filter(e=>(e.notes||'').toLowerCase().includes(search.toLowerCase())||e.category.toLowerCase().includes(search.toLowerCase()));
  const total = filtered.reduce((s,e)=>s+e.amount,0);
  const tally = getFamilyTally(data.collections, expenses);

  return (
    <div className="screen">
      <Header title="Expenses" subtitle={`${filtered.length} items · ${fmt(total)}`}
        onBack={() => navigate(dashRoute(group?.type), { groupId })}
        right={<button className="icon-btn glow-b" onClick={() => exportXLSX(group.name, data.collections, expenses, tally, members)}><Download size={15}/></button>}
      />
      <div className="content">
        <input className="input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
        {cats.length>2 && (
          <div className="filter-row">
            {cats.map(cat => (
              <button key={cat} className={`filter-chip ${filter===cat?'active':''}`} onClick={()=>setFilter(cat)}>
                {cat==='All'?'All':`${CAT_ICON[cat]||'📌'} ${cat}`}
              </button>
            ))}
          </div>
        )}
        <div className="card" style={{ background:'var(--accent-bg)', borderColor:'var(--accent)', padding:'14px 18px' }}>
          <div className="flex-between">
            <span style={{ fontSize:13, color:'var(--text2)' }}>{filter==='All'?'Total Expenses':filter}</span>
            <span style={{ fontWeight:700, fontSize:22, color:'var(--accent)', letterSpacing:'-0.03em' }}>{fmt(total)}</span>
          </div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setSheet('new')}>+ Add Expense</button>
        )}
        {filtered.length===0 && <EmptyState icon="🧾" title="No expenses yet" sub="Add an expense when money is spent" />}
        {filtered.map(e => (
          <EntryCard key={e.id} e={e} isCollection={false} isAdmin={isAdmin} memberMap={memberMap}
            onEdit={() => setSheet({ item:e })}
            onDelete={() => handleDelete(e.id)}
          />
        ))}
      </div>
      {sheet && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSheet(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-title">{sheet?.item ? 'Edit Expense' : '+ Add Expense'}</div>
            <TransactionForm type="expense" groupType={group?.type} members={members}
              initial={sheet?.item} onSave={handleSave} onCancel={() => setSheet(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ActivityLogScreen({ navigate, groupId }) {
  const [logs, setLogs]   = useState([]);
  const [group, setGroup] = useState(null);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    getAuditLogsStatic(groupId).then(setLogs);
    getGroupStatic(groupId).then(setGroup);
  }, [groupId]);

  const filtered = filter==='All' ? logs : logs.filter(l=>l.entity===filter);

  function timeAgo(val) {
    if (!val) return 'some time ago';
    // Handle both numeric timestamp and ISO string
    const ms = typeof val === 'number' ? val : new Date(val).getTime();
    if (isNaN(ms)) return 'some time ago';
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(ms).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  }

  return (
    <div className="screen">
      <Header title="Activity Log" subtitle={`${logs.length} events`} onBack={()=>navigate(dashRoute(group?.type),{groupId})} />
      <div className="content">
        <div className="filter-row">
          {['All','collection','expense','settlement','member','group'].map(e=>(
            <button key={e} className={`filter-chip ${filter===e?'active':''}`} onClick={()=>setFilter(e)}>
              {e==='All'?'All':e.charAt(0).toUpperCase()+e.slice(1)+'s'}
            </button>
          ))}
        </div>
        {filtered.length===0 && <EmptyState icon="📋" title="No activity yet" sub="All changes will be logged here with timestamps" />}
        <div className="card" style={{ padding:'4px 18px' }}>
          {filtered.map((l, idx)=>(
            <div key={l.lid || l.id || idx} className="log-item">
              <div className={`log-dot ${l.action||'create'}`} />
              <div className="log-body">
                <div className="log-detail">{l.detail}</div>
                <div className="log-meta">👤 {l.changed_by} · {timeAgo(l.timestamp || l.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettlementScreen({ navigate, groupId }) {
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances]       = useState([]);
  const [groupName, setGroupName]     = useState('');
  const [settled, setSettled]         = useState([]);

  useEffect(() => {
    getGroupDataStatic(groupId).then(d => {
        setGroupName(d.group?.name||'');
        const bals = calculateBalances(d.members, d.expenses, d.participantsMap, d.collections, d.group?.mode);
        setBalances(bals);
        setSettlements(calculateSettlements(bals));
      });
  }, [groupId]);

  const toggle = i => setSettled(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]);

  return (
    <div className="screen">
      <Header title="Settlement" subtitle={`${settlements.length} transactions needed`} onBack={()=>navigate('dashboard',{groupId})} />
      <div className="content">
        {settlements.length===0 ? (
          <div style={{ textAlign:'center', padding:'56px 20px' }}>
            <div style={{ fontSize:52 }}>🎉</div>
            <div style={{ fontWeight:600, fontSize:20, letterSpacing:'-0.01em', marginTop:12 }}>All Settled!</div>
            <div style={{ color:'var(--text2)', fontSize:14, marginTop:6 }}>Everyone is even.</div>
          </div>
        ) : settlements.map((s,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background:'var(--surface)', border:`1px solid ${settled.includes(i)?'var(--green)':'var(--border)'}`, borderRadius:0, padding:'14px 16px', cursor:'pointer', opacity:settled.includes(i)?.55:1, transition:'all .2s' }}
            onClick={()=>{toggle(i);sounds.tap();}}>
            <div style={{ width:34,height:34,borderRadius:0,background:settled.includes(i)?'var(--green-bg)':'var(--surface2)',border:`2px solid ${settled.includes(i)?'var(--green)':'var(--border2)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,transition:'all .2s' }}>
              {settled.includes(i)?'✓':'○'}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{s.from}</div>
              <div style={{ fontSize:11, color:'var(--text3)', margin:'2px 0' }}>↓ pays</div>
              <div style={{ fontSize:13, color:'var(--text2)' }}>{s.to}</div>
            </div>
            <div style={{ fontWeight:700, fontSize:18, color:'var(--pink)', letterSpacing:'-0.03em' }}>{fmt(s.amount)}</div>
          </div>
        ))}
        <div className="section-title" style={{ marginTop:8 }}>Balances</div>
        <div className="card" style={{ padding:'4px 18px' }}>
          {balances.map(m=>(
            <div key={m.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 0',borderBottom:'1px solid var(--border)' }}>
              <div className="avatar avatar-sm">{m.name[0].toUpperCase()}</div>
              <div style={{ flex:1,fontWeight:600,fontSize:13,color:'var(--text)' }}>{m.name}</div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:700,fontSize:14,letterSpacing:'-0.02em',color:m.balance>.5?'var(--green)':m.balance<-.5?'var(--red)':'var(--text3)' }}>
                  {m.balance>.5?'+':''}{fmt(m.balance)}
                </div>
                <div style={{ fontSize:10,color:'var(--text3)',marginTop:2 }}>
                  {m.balance>.5?'gets back':m.balance<-.5?'owes':'✓ even'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BudgetCalculatorScreen({ navigate }) {
  const [people, setPeople]   = useState('');
  const [perPerson, setPer]   = useState('');
  const [items, setItems]     = useState([{ name:'', amount:'' }]);
  const totalBudget   = parseFloat(people||0)*parseFloat(perPerson||0);
  const totalPlanned  = items.reduce((s,i)=>s+parseFloat(i.amount||0),0);
  const remaining     = totalBudget - totalPlanned;
  const addItem       = () => setItems([...items,{name:'',amount:''}]);
  const updateItem    = (i,f,v) => { const n=[...items]; n[i][f]=v; setItems(n); };
  const removeItem    = i => setItems(items.filter((_,j)=>j!==i));

  return (
    <div className="screen">
      <Header title="Budget Calculator" subtitle="Plan before you spend" onBack={()=>navigate('home')} />
      <div className="content">
        <div className="card" style={{ background:'var(--accent-bg)', borderColor:'var(--accent)' }}>
          <div className="section-title" style={{ marginBottom:10 }}>Collection Estimate</div>
          <div className="btn-row">
            <div className="input-group">
              <div className="input-label">No. of People</div>
              <input className="input" type="number" placeholder="50" value={people} onChange={e=>setPeople(e.target.value)} />
            </div>
            <div className="input-group">
              <div className="input-label">Per Person (₹)</div>
              <input className="input" type="number" placeholder="500" value={perPerson} onChange={e=>setPer(e.target.value)} />
            </div>
          </div>
          {totalBudget>0 && (
            <div style={{ marginTop:12, textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Estimated Total</div>
              <div style={{ fontWeight:700, fontSize:30, color:'var(--accent)', letterSpacing:'-0.04em', marginTop:4 }}>{fmt(totalBudget)}</div>
            </div>
          )}
        </div>
        <div className="section-title">Planned Items</div>
        {items.map((item,i)=>(
          <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input className="input" placeholder="Item name" value={item.name} onChange={e=>updateItem(i,'name',e.target.value)} style={{ flex:2 }} />
            <input className="input" type="number" placeholder="₹" value={item.amount} onChange={e=>updateItem(i,'amount',e.target.value)} style={{ flex:1 }} />
            {items.length>1 && <button onClick={()=>removeItem(i)} style={{ background:'none',border:'none',color:'var(--red)',cursor:'pointer',padding:4,fontSize:20,flexShrink:0 }}>×</button>}
          </div>
        ))}
        <button className="btn btn-ghost" onClick={addItem}>+ Add Item</button>
        {totalPlanned>0 && (
          <div className="tally-card">
            <div className="tally-rows">
              <div className="tally-row"><span className="tally-label">💰 Est. Collection</span><span className="tally-value text-green">{fmt(totalBudget)}</span></div>
              <div className="tally-row"><span className="tally-label">🧾 Planned Spend</span><span className="tally-value text-accent">{fmt(totalPlanned)}</span></div>
              <div className="tally-row">
                <span className="tally-label">{remaining>=0?'✅ Buffer':'⚠️ Shortfall'}</span>
                <span className={`tally-value ${remaining>=0?'text-green':'text-red'}`}>{fmt(remaining)}</span>
              </div>
            </div>
          </div>
        )}
        {totalPlanned>0&&totalBudget>0&&remaining<0 && (
          <div className="alert alert-danger"><span className="alert-icon">⚠️</span><span>Short by ₹{Math.abs(remaining).toLocaleString('en-IN')}. Collect more or reduce spend.</span></div>
        )}
        {totalPlanned>0&&totalBudget>0&&remaining>=0 && (
          <div className="alert alert-success"><span className="alert-icon">✓</span><span>Budget looks good! ₹{remaining.toLocaleString('en-IN')} buffer.</span></div>
        )}
      </div>
    </div>
  );
}
