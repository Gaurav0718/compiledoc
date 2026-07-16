import React, { useState, useEffect, useCallback } from 'react';
import { getGroupData, addExpense, updateExpense, deleteExpense, addSettlement, deleteSettlement, closeGroup, checkIsAdmin } from '../db/database';
import { calculateSplitwiseBalances, calculateSettlements } from '../logic/calculations';
import { exportXLSX, exportPDF } from '../logic/export';
import { Header, fmt, fmtDate, PaymentBadge, EmptyState } from '../components/ui';
import TransactionForm from '../components/TransactionForm';
import { useAuth } from '../hooks/useAuth';
import { sounds } from '../logic/sounds';
import { Plus, Download, FileText, Settings, Pencil, Trash2, Lock, Unlock, HandCoins } from 'lucide-react';

const CAT_ICON = {'Food':'🍽️','Transport':'🚗','Hotel':'🏨','Activities':'🎯','Shopping':'🛍️','Medical':'💊','Fuel':'⛽','Other':'📌'};

function SettleForm({ from, to, suggested, onSave, onCancel }) {
  const today = new Date().toISOString().split('T')[0];
  const [amount, setAmount] = useState(suggested?.toFixed(2) || '');
  const [notes, setNotes]   = useState('');
  const [date, setDate]     = useState(today);
  const [error, setError]   = useState('');

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div className="card" style={{ background:'var(--accent-bg)', borderColor:'var(--accent)', textAlign:'center' }}>
        <div style={{ fontWeight:700, fontSize:15 }}>{from?.name}</div>
        <div style={{ fontSize:11, color:'var(--text3)', margin:'2px 0' }}>↓ pays</div>
        <div style={{ fontWeight:700, fontSize:15 }}>{to?.name}</div>
      </div>
      <div className="input-group">
        <div className="input-label">Amount (₹)</div>
        <input className="input input-big" type="number" placeholder="0"
          value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} autoFocus />
      </div>
      <div className="input-group">
        <div className="input-label">Date</div>
        <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="input-group">
        <div className="input-label">Notes (optional)</div>
        <input className="input" placeholder="e.g. Paid via GPay" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      {error && <div style={{ fontSize:13, color:'var(--red)', background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:0, padding:'9px 14px', textAlign:'center' }}>{error}</div>}
      <button className="btn btn-primary" onClick={() => {
        if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount'); return; }
        onSave({ amount: parseFloat(amount), notes, date });
      }}>✓ Record Settlement</button>
      <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
    </div>
  );
}

export default function SplitwiseDashboard({ navigate, groupId }) {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [balances, setBals]   = useState([]);
  const [settleTxns, setSettleTxns] = useState([]);
  const [sheet, setSheet]     = useState(null); // 'new' | {item} | {settle:{from,to,amount}}
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    const d = await getGroupData(groupId);
    setData(d);
    const bals = calculateSplitwiseBalances(d.members, d.expenses, d.splitsMap, d.settlements);
    setBals(bals);
    setSettleTxns(calculateSettlements(bals));
    const admin = await checkIsAdmin(groupId, user);
    setIsAdmin(admin);
  }, [groupId, user]);

  useEffect(() => { load(); }, [load]);

  const handleSaveExpense = async (vals) => {
    if (sheet?.item) await updateExpense({ id:sheet.item.id, group_id:groupId, uid:user.uid, by:user.displayName, ...vals });
    else await addExpense({ group_id:groupId, uid:user.uid, by:user.displayName, ...vals });
    sounds.success(); setSheet(null); load();
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Delete expense?')) return;
    await deleteExpense(id, groupId, user.uid, user.displayName);
    sounds.delete(); load();
  };

  const handleSettle = async (from, to, vals) => {
    await addSettlement({ group_id: groupId, uid: user.uid, by: user.displayName, from_member: from.id, to_member: to.id, ...vals });
    sounds.success(); setSheet(null); load();
  };

  const handleDeleteSettlement = async (id) => {
    if (!confirm('Remove this settlement?')) return;
    await deleteSettlement(id, groupId, user.uid, user.displayName);
    sounds.delete(); load();
  };

  const handleToggleClose = async () => {
    const closing = !data.group.closed;
    if (closing) {
      const outstanding = settleTxns.length;
      const msg = outstanding
        ? `${outstanding} payment${outstanding>1?'s':''} still needed to settle everyone up. Close the group anyway? It will become read-only.`
        : `Close "${data.group.name}"? It will become read-only. You can reopen it any time.`;
      if (!confirm(msg)) return;
    }
    await closeGroup(groupId, closing, user.uid, user.displayName);
    sounds.success(); load();
  };

  if (!data) return <div className="screen"><div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)' }}>Loading…</div></div>;

  const { group, expenses, members, settlements } = data;
  const totalSpent = expenses.reduce((s,e)=>s+e.amount,0);
  const closed = !!group?.closed;
  const memberMap = {}; members.forEach(m => memberMap[m.id] = m);
  const canEdit = isAdmin && !closed;

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
        {closed && (
          <div className="card" style={{ textAlign:'center', background:'var(--surface2)', borderColor:'var(--border2)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontSize:13, color:'var(--text2)' }}>
            <Lock size={14}/> This group is closed — read-only
          </div>
        )}

        <div className="tally-card">
          <div className="tally-header">
            <div>
              <div className="tally-title">Total Spent</div>
              <div className="tally-balance text-accent">{fmt(totalSpent)}</div>
            </div>
          </div>
          <div className="tally-rows">
            {balances.map(m => (
              <div key={m.id} className="tally-row">
                <span className="tally-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div className="avatar avatar-xs">{m.name[0].toUpperCase()}</div> {m.name}
                </span>
                <span style={{ textAlign:'right' }}>
                  <span className={`tally-value ${m.balance>.5?'text-green':m.balance<-.5?'text-red':''}`}>
                    {m.balance>.5?'+':''}{fmt(m.balance)}
                  </span>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>
                    {m.balance>.5?'gets back':m.balance<-.5?'owes':'✓ settled'}
                  </div>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="section-title">Who Owes Whom</div>
        {settleTxns.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:'24px 16px' }}>
            <div style={{ fontSize:36 }}>🎉</div>
            <div style={{ fontWeight:700, fontSize:15, marginTop:8 }}>All settled up!</div>
          </div>
        ) : (
          <div className="card" style={{ padding:'4px 18px' }}>
            {settleTxns.map((s, i) => {
              const fromM = members.find(m => m.name === s.from);
              const toM   = members.find(m => m.name === s.to);
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom: i<settleTxns.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex:1, fontSize:13 }}>
                    <strong>{s.from}</strong> <span style={{ color:'var(--text3)' }}>owes</span> <strong>{s.to}</strong>
                  </div>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--pink)' }}>{fmt(s.amount)}</div>
                  {canEdit && fromM && toM && (
                    <button className="btn btn-xs btn-secondary" style={{ fontSize:11, padding:'5px 10px' }}
                      onClick={() => setSheet({ settle: { from: fromM, to: toM, amount: s.amount } })}>
                      <HandCoins size={12}/> Settle
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canEdit && (
          <button className="btn btn-action" onClick={() => setSheet('new')}><Plus size={16}/> Add Expense</button>
        )}
        <div className="btn-row-3">
          <button className="btn btn-action" onClick={() => exportXLSX(group.name, [], expenses, { totalCollected:0, totalExpenses:totalSpent, balance:0 }, members, settlements)}><Download size={14}/> Excel</button>
          <button className="btn btn-action" onClick={() => exportPDF(group.name, [], expenses, { totalCollected:0, totalExpenses:totalSpent, balance:0, isDeficit:false }, members, settlements)}><FileText size={14}/> PDF</button>
          <button className="btn btn-action" onClick={() => navigate('activityLog', { groupId })}>Activity</button>
        </div>

        <div className="section-title">Expenses ({expenses.length})</div>
        {expenses.length === 0 && <EmptyState icon="💸" title="No expenses yet" sub="Add an expense to start splitting costs" />}
        {expenses.map(e => {
          const splits = data.splitsMap?.[e.id] || [];
          return (
            <div key={e.id} className="entry-item">
              <div className="entry-icon">{CAT_ICON[e.category]||'📌'}</div>
              <div className="entry-body">
                <div className="entry-title">{e.notes||e.category}</div>
                <div className="entry-meta">
                  <PaymentBadge mode={e.payment_mode} />
                  <span>{memberMap[e.paid_by]?.name ? `Paid by ${memberMap[e.paid_by].name}` : e.category}</span>
                  <span>{fmtDate(e.date)}</span>
                  {splits.length > 0 && <span>Split {splits.length} way{splits.length>1?'s':''}</span>}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div className="entry-amount text-accent">{fmt(e.amount)}</div>
                {canEdit && (
                  <>
                    <button className="action-btn edit" onClick={() => setSheet({ item: { ...e, splits } })}><Pencil size={13}/></button>
                    <button className="action-btn del"  onClick={() => handleDeleteExpense(e.id)}><Trash2 size={13}/></button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {settlements.length > 0 && (
          <>
            <div className="section-title">Settlement History</div>
            {settlements.map(s => (
              <div key={s.id} className="entry-item">
                <div className="entry-icon" style={{ background:'var(--green-bg)', borderColor:'var(--green)' }}>💸</div>
                <div className="entry-body">
                  <div className="entry-title">{memberMap[s.from_member]?.name || '?'} → {memberMap[s.to_member]?.name || '?'}</div>
                  <div className="entry-meta">
                    {s.notes && <span>{s.notes}</span>}
                    <span>{fmtDate(s.date)}</span>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div className="entry-amount text-green">{fmt(s.amount)}</div>
                  {canEdit && (
                    <button className="action-btn del" onClick={() => handleDeleteSettlement(s.id)}><Trash2 size={13}/></button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <div style={{ height:1, background:'var(--border)', margin:'8px 0' }}/>
            <button className={closed ? 'btn btn-secondary' : 'btn btn-danger'} onClick={handleToggleClose} style={{ fontSize:14 }}>
              {closed ? <><Unlock size={16}/> Reopen Group</> : <><Lock size={16}/> Close Group</>}
            </button>
            <div style={{ fontSize:12, color:'var(--text3)', textAlign:'center', marginTop:-4 }}>
              {closed ? 'Reopen to allow expenses and settlements again.' : 'Closing freezes the group as read-only. You can reopen any time.'}
            </div>
          </>
        )}
      </div>

      {(sheet === 'new' || sheet?.item) && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSheet(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-title">{sheet?.item ? 'Edit Expense' : '+ Add Expense'}</div>
            <TransactionForm type="expense" groupType="splitwise" members={members}
              initial={sheet?.item} onSave={handleSaveExpense} onCancel={() => setSheet(null)} />
          </div>
        </div>
      )}

      {sheet?.settle && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSheet(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-title">Settle Up</div>
            <SettleForm from={sheet.settle.from} to={sheet.settle.to} suggested={sheet.settle.amount}
              onSave={vals => handleSettle(sheet.settle.from, sheet.settle.to, vals)}
              onCancel={() => setSheet(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
