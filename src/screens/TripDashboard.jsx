import React, { useState, useEffect, useCallback } from 'react';
import { getGroupData, addExpense, addCollection, updateExpense, deleteExpense, checkIsAdmin } from '../db/database';
import { calculateBalances, getCategoryTotals } from '../logic/calculations';
import { exportXLSX, exportPDF } from '../logic/export';
import { Header, fmt, fmtDate, PaymentBadge, EmptyState } from '../components/ui';
import TransactionForm from '../components/TransactionForm';
import { useAuth } from '../hooks/useAuth';
import { sounds } from '../logic/sounds';
import { Plus, Download, FileText, Settings, Pencil, Trash2, List, Activity, CreditCard } from 'lucide-react';

const CAT_ICON = {'Food':'🍽️','Transport':'🚗','Hotel':'🏨','Activities':'🎯','Shopping':'🛍️','Medical':'💊','Fuel':'⛽','Other':'📌'};

export default function TripDashboard({ navigate, groupId }) {
  const { user } = useAuth();
  const [data, setData]   = useState(null);
  const [balances, setBals] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setError(false);
    try {
      const d = await getGroupData(groupId);
      setData(d);
      setBals(calculateBalances(d.members, d.expenses, d.splitsMap, d.collections, d.group?.mode));
      const admin = await checkIsAdmin(groupId, user);
      setIsAdmin(admin);
    } catch {
      setError(true);
    }
  }, [groupId, user]);

  useEffect(() => { load(); }, [load]);

  const handleSaveExpense = (vals) => {
    // Close immediately — the actual write is a network round trip, and
    // waiting on it before dismissing the sheet is what made "Save" feel
    // slow/unresponsive, especially on a slower mobile connection.
    const item = sheet?.item;
    setSheet(null);
    (async () => {
      try {
        if (item) await updateExpense({ id:item.id, group_id:groupId, uid:user.uid, by:user.displayName, ...vals });
        else await addExpense({ group_id:groupId, uid:user.uid, by:user.displayName, ...vals });
        sounds.success();
      } catch (e) {
        alert(`Couldn't save: ${e.message || 'check your connection and try again'}`);
      }
      load();
    })();
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Delete expense?')) return;
    await deleteExpense(id, groupId, user.uid, user.displayName);
    sounds.delete(); load();
  };

  if (error) return <div className="screen">
    <Header title="Trip" onBack={() => navigate('home')} />
    <div style={{ flex:1,display:'flex',flexDirection:'column',gap:12,alignItems:'center',justifyContent:'center',color:'var(--text3)',padding:20,textAlign:'center' }}>
      <div>Couldn't load this group. Check your connection and try again.</div>
      <button className="btn btn-secondary" onClick={load}>Retry</button>
    </div>
  </div>;
  if (!data) return <div className="screen">
    <Header title="Trip" onBack={() => navigate('home')} />
    <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)' }}>Loading…</div>
  </div>;

  const { group, expenses, members } = data;
  const totalSpent = expenses.reduce((s,e)=>s+e.amount,0);
  const perPerson  = members.length>0 ? totalSpent/members.length : 0;
  const tally = { totalCollected: totalSpent, totalExpenses: totalSpent, balance: 0, isDeficit:false,isSurplus:false,isBalanced:true };

  return (
    <div className="screen">
      <Header title={group?.name} subtitle={`${members.length} members · ${expenses.length} expenses`}
        onBack={() => navigate('home')}
        right={
          isAdmin && (
            <button className="icon-btn glow-v" onClick={() => navigate('adminPanel', { groupId })}>
              <Settings size={15} />
            </button>
          )
        }
      />
      <div className="content">
        <div className="tally-card">
          <div className="tally-header">
            <div>
              <div className="tally-title">Total Spent</div>
              <div className="tally-balance text-accent">{fmt(totalSpent)}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div className="tally-title">Per Person</div>
              <div style={{ fontWeight:700, fontSize:22, marginTop:5, letterSpacing:'-0.03em', color:'var(--text)' }}>{fmt(perPerson)}</div>
            </div>
          </div>
          <div className="tally-rows">
            {balances.slice(0,5).map(m=>(
              <div key={m.id} className="tally-row">
                <span className="tally-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div className="avatar avatar-xs">{m.name[0].toUpperCase()}</div> {m.name}
                </span>
                <span className={`tally-value ${m.balance>.5?'text-green':m.balance<-.5?'text-red':''}`}>
                  {m.balance>.5?'+':''}{fmt(m.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isAdmin ? (
          <>
            {group?.mode==='audit' ? (
              <div className="btn-row">
                <button className="btn btn-action" onClick={() => setSheet('new')}><Plus size={16}/> Add Expense</button>
                <button className="btn btn-action" onClick={() => setSheet('col')}><Plus size={16}/> Collection</button>
              </div>
            ) : (
              <button className="btn btn-action" onClick={() => setSheet('new')}><Plus size={16}/> Add Expense</button>
            )}
            <div className="btn-row">
              <button className="btn btn-action" onClick={() => exportXLSX(group.name,data.collections,expenses,tally,members)}><Download size={14}/> Excel</button>
              <button className="btn btn-action" onClick={() => exportPDF(group.name,data.collections,expenses,tally)}><FileText size={14}/> PDF</button>
            </div>
          </>
        ) : (
          <div className="card" style={{ textAlign:'center', fontSize:13, color:'var(--text2)', padding:14, background:'var(--accent-bg)', borderColor:'var(--accent)' }}>
            👁️ Viewer mode
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
          {[
            { icon:'🧾', label:'Expenses', s:'expenseList' },
            { icon:'💸', label:'Settle',   s:'settlement' },
            { icon:'📊', label:'Activity', s:'activityLog' },
            { icon:'🛡️', label:'Admin',    s:'adminPanel' },
          ].map(b=>(
            <button key={b.s} className="btn btn-secondary" style={{ flexDirection:'column', gap:4, height:54, fontSize:11, padding:'6px 4px' }}
              onClick={() => navigate(b.s, { groupId })}>
              <span style={{ fontSize:18, filter:'drop-shadow(0 0 4px currentColor)' }}>{b.icon}</span>{b.label}
            </button>
          ))}
        </div>

        {[...expenses].slice(0,5).map(e=>(
          <div key={e.id} className="entry-item">
            <div className="entry-icon">{CAT_ICON[e.category]||'📌'}</div>
            <div className="entry-body">
              <div className="entry-title">{e.notes||e.category}</div>
              <div className="entry-meta">
                <PaymentBadge mode={e.payment_mode} />
                <span>{fmtDate(e.date)}</span>
                {e.proof_image && <span style={{ color:'var(--blue)', fontSize:10 }}>📎</span>}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div className="entry-amount text-accent">{fmt(e.amount)}</div>
              {isAdmin && (
                <>
                  <button className="action-btn edit" onClick={() => setSheet({item:e})}><Pencil size={13}/></button>
                  <button className="action-btn del"  onClick={() => handleDeleteExpense(e.id)}><Trash2 size={13}/></button>
                </>
              )}
            </div>
          </div>
        ))}

        {expenses.length===0 && <EmptyState icon="✈️" title="No expenses yet" sub="Start adding trip expenses" />}
      </div>

      {(sheet === 'new' || sheet?.item) && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSheet(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-title">{sheet?.item ? 'Edit Expense' : '+ Add Expense'}</div>
            <TransactionForm type="expense" groupType="trip" members={members}
              initial={sheet?.item} onSave={handleSaveExpense} onCancel={() => setSheet(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
