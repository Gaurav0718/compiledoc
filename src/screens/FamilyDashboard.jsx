import React, { useState, useEffect, useCallback } from 'react';
import { getGroupData, addCollection, addExpense, updateCollection, updateExpense, deleteCollection, deleteExpense, checkIsAdmin } from '../db/database';
import { getFamilyTally, getMismatches, getCategoryTotals } from '../logic/calculations';
import { exportXLSX, exportPDF } from '../logic/export';
import { Header, Alert, ThemeToggle, fmt, fmtDate, PaymentBadge, EmptyState } from '../components/ui';
import TransactionForm from '../components/TransactionForm';
import { useAuth } from '../hooks/useAuth';
import { sounds } from '../logic/sounds';
import { Plus, Download, List, FileText, Users, Activity, Settings, Pencil, Trash2, ChevronRight } from 'lucide-react';

const CAT_ICON = {'Venue':'🏛️','Catering':'🍽️','Decoration':'🎀','Sound & Lighting':'🎵','Videography':'🎬','Photography':'📷','Gifts':'🎁','Transport':'🚗','Invitations':'📬','Sweets & Snacks':'🍬','Pooja Items':'🪔','DJ / Music':'🎧','Flowers':'🌸','Clothing':'👗','Miscellaneous':'📦','Food':'🍽️','Hotel':'🏨','Activities':'🎯','Shopping':'🛍️','Medical':'💊','Fuel':'⛽','Other':'📌'};

export default function FamilyDashboard({ navigate, groupId }) {
  const { user } = useAuth();
  const [data, setData]         = useState(null);
  const [tally, setTally]       = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [catTotals, setCats]    = useState([]);
  const [sheet, setSheet]       = useState(null); // 'collection' | 'expense' | {type,item}
  const [isAdmin, setIsAdmin]   = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    const d = await getGroupData(groupId);
    setData(d);
    const t = getFamilyTally(d.collections, d.expenses);
    setTally(t);
    setWarnings(getMismatches(d.collections, d.expenses, t));
    setCats(getCategoryTotals(d.expenses));
    const admin = await checkIsAdmin(groupId, user);
    setIsAdmin(admin);
  }, [groupId, user]);

  useEffect(() => { load(); }, [load]);

  const handleSaveCollection = async (vals) => {
    if (sheet?.item) {
      await updateCollection({ id: sheet.item.id, group_id: groupId, uid: user.uid, by: user.displayName, ...vals });
    } else {
      await addCollection({ group_id: groupId, uid: user.uid, by: user.displayName, ...vals });
    }
    sounds.success();
    setSheet(null); load();
  };

  const handleSaveExpense = async (vals) => {
    if (sheet?.item) {
      await updateExpense({ id: sheet.item.id, group_id: groupId, uid: user.uid, by: user.displayName, ...vals });
    } else {
      await addExpense({ group_id: groupId, uid: user.uid, by: user.displayName, ...vals });
    }
    sounds.success();
    setSheet(null); load();
  };

  const handleDeleteCollection = async (id) => {
    if (!confirm('Delete this collection?')) return;
    await deleteCollection(id, groupId, user.uid, user.displayName);
    sounds.delete(); load();
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return;
    await deleteExpense(id, groupId, user.uid, user.displayName);
    sounds.delete(); load();
  };

  if (!data || !tally) return <div className="screen"><div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)' }}>Loading…</div></div>;

  const { group, expenses, collections, members } = data;
  const collectPct = tally.totalExpenses > 0 ? Math.min(100, (tally.totalCollected/tally.totalExpenses)*100) : 100;

  const handleExportXLSX = () => { sounds.tap(); exportXLSX(group.name, collections, expenses, tally, members); };
  const handleExportPDF  = () => { sounds.tap(); exportPDF(group.name, collections, expenses, tally); };

  return (
    <div className="screen">
      <Header title={group?.name} subtitle={`${collections.length} collections · ${expenses.length} expenses`}
        onBack={() => navigate('home')}
        right={
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <ThemeToggle />
            {isAdmin && (
              <button className="icon-btn glow-v" onClick={() => navigate('adminPanel', { groupId })} title="Admin Panel">
                <Settings size={15} />
              </button>
            )}
          </div>
        }
      />

      <div className="content">
        {/* TALLY CARD */}
        <div className={`tally-card${tally.isSurplus?' surplus':tally.isDeficit?' deficit':''}`}>
          <div className="tally-header">
            <div>
              <div className="tally-title">Balance</div>
              <div className={`tally-balance ${tally.isDeficit?'text-red deficit-glow':tally.isSurplus?'text-green surplus-glow':'text-accent'}`}>
                {tally.isDeficit?'−':tally.isSurplus?'+':''}{fmt(tally.balance)}
              </div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
                {tally.isDeficit?'⚠️ Expenses exceed collections':tally.isSurplus?'✓ Surplus remaining':'✓ Balanced'}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div className="tally-title">Coverage</div>
              <div style={{ fontWeight:700, fontSize:24, color: collectPct>=100?'var(--green)':'var(--red)', marginTop:4, letterSpacing:'-0.03em' }}>
                {Math.round(collectPct)}%
              </div>
            </div>
          </div>
          <div className="tally-rows">
            <div className="tally-row">
              <span className="tally-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'var(--green)', filter:'drop-shadow(0 0 4px var(--green))' }}>💰</span> Collected
              </span>
              <span className="tally-value text-green">{fmt(tally.totalCollected)}</span>
            </div>
            <div className="tally-row">
              <span className="tally-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'var(--accent)', filter:'drop-shadow(0 0 4px var(--accent))' }}>🧾</span> Spent
              </span>
              <span className="tally-value text-accent">{fmt(tally.totalExpenses)}</span>
            </div>
          </div>
          <div className="tally-bar-wrap">
            <div className="tally-bar-label"><span>Spent</span><span>Collected</span></div>
            <div className="tally-bar-track">
              <div className="tally-bar-fill" style={{ width:`${collectPct}%`, background: collectPct>=100?'var(--green)':collectPct>=75?'var(--accent)':'var(--red)' }} />
            </div>
          </div>
        </div>

        {/* ALERTS */}
        {warnings.map((w,i) => <Alert key={i} type={w.type}>{w.msg}</Alert>)}

        {/* ACTIONS */}
        {isAdmin ? (
          <>
            <div className="btn-row">
              <button className="btn btn-action" onClick={() => setSheet('collection')}>
                <Plus size={16}/> Collection
              </button>
              <button className="btn btn-action" onClick={() => setSheet('expense')}>
                <Plus size={16}/> Expense
              </button>
            </div>
            <div className="btn-row">
              <button className="btn btn-action" onClick={handleExportXLSX}><Download size={14}/> Excel</button>
              <button className="btn btn-action" onClick={handleExportPDF}><FileText size={14}/> PDF</button>
            </div>
          </>
        ) : (
          <div className="card" style={{ textAlign:'center', fontSize:13, color:'var(--text2)', padding:14, background:'var(--accent-bg)', borderColor:'var(--accent)' }}>
            👁️ Viewer mode — contact an admin to make changes
          </div>
        )}

        <div className="btn-row-3">
          {[
            { icon:'📋', label:'Collections', s:'collectionList' },
            { icon:'🧾', label:'Expenses',    s:'expenseList' },
            { icon:'📊', label:'Activity',    s:'activityLog' },
          ].map(b => (
            <button key={b.s} className="btn btn-secondary" style={{ flexDirection:'column', gap:4, height:56, fontSize:12, padding:'8px 4px' }}
              onClick={() => navigate(b.s, { groupId })}>
              <span style={{ fontSize:18, filter:'drop-shadow(0 0 4px currentColor)' }}>{b.icon}</span>
              {b.label}
            </button>
          ))}
        </div>

        {/* CATEGORY BREAKDOWN */}
        {catTotals.length > 0 && (
          <>
            <div className="section-title">Expense Breakdown</div>
            <div className="card" style={{ padding:'4px 18px' }}>
              {catTotals.map(({ cat, total, count }) => (
                <div key={cat} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:20 }}>{CAT_ICON[cat]||'📌'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{cat}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{count} item{count>1?'s':''}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, textAlign:'right', color:'var(--text)' }}>{fmt(total)}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', textAlign:'right' }}>
                      {tally.totalExpenses>0?`${Math.round(total/tally.totalExpenses*100)}%`:'—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* RECENT */}
        {[...collections].reverse().slice(0,3).map(c => (
          <div key={c.id} className="entry-item">
            <div className="entry-icon" style={{ background:'var(--green-bg)', borderColor:'var(--green)' }}>💰</div>
            <div className="entry-body">
              <div className="entry-title">{c.member_name}</div>
              <div className="entry-meta">
                <PaymentBadge mode={c.payment_mode} />
                {c.notes && <span>{c.notes}</span>}
                <span>{fmtDate(c.date)}</span>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div className="entry-amount text-green">{fmt(c.amount)}</div>
              {isAdmin && (
                <>
                  <button className="action-btn edit" onClick={() => setSheet({ type:'collection', item:c })}><Pencil size={13}/></button>
                  <button className="action-btn del"  onClick={() => handleDeleteCollection(c.id)}><Trash2 size={13}/></button>
                </>
              )}
            </div>
          </div>
        ))}

        {[...expenses].slice(0,3).map(e => (
          <div key={e.id} className="entry-item">
            <div className="entry-icon">{CAT_ICON[e.category]||'📌'}</div>
            <div className="entry-body">
              <div className="entry-title">{e.notes||e.category}</div>
              <div className="entry-meta">
                <PaymentBadge mode={e.payment_mode} />
                <span>{e.category}</span>
                <span>{fmtDate(e.date)}</span>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div className="entry-amount text-accent">{fmt(e.amount)}</div>
              {isAdmin && (
                <>
                  <button className="action-btn edit" onClick={() => setSheet({ type:'expense', item:e })}><Pencil size={13}/></button>
                  <button className="action-btn del"  onClick={() => handleDeleteExpense(e.id)}><Trash2 size={13}/></button>
                </>
              )}
            </div>
          </div>
        ))}

        {collections.length===0 && expenses.length===0 && (
          <EmptyState icon="🏠" title="Ready to track!" sub="Add a collection when someone contributes,\nadd an expense when money is spent." />
        )}
      </div>

      {/* BOTTOM SHEET */}
      {sheet && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setSheet(null)}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-title">
              {sheet === 'collection' || sheet?.type === 'collection'
                ? (sheet?.item ? 'Edit Collection' : '+ Add Collection')
                : (sheet?.item ? 'Edit Expense' : '+ Add Expense')}
            </div>
            <TransactionForm
              type={sheet==='collection'||sheet?.type==='collection' ? 'collection' : 'expense'}
              groupType="family"
              members={members}
              initial={sheet?.item}
              onSave={sheet==='collection'||sheet?.type==='collection' ? handleSaveCollection : handleSaveExpense}
              onCancel={() => setSheet(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
