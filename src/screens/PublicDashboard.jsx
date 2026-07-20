import React, { useState, useEffect } from 'react';
import { getGroupData } from '../db/database';
import { getFamilyTally, getCategoryTotals, calculateBalances, calculateSplitwiseBalances, calculateSettlements } from '../logic/calculations';
import { fmt, fmtDate, PaymentBadge, ThemeToggle } from '../components/ui';
import { ArrowLeft, Lock, Copy, Check, Share2 } from 'lucide-react';

const CAT_ICON = {'Venue':'🏛️','Catering':'🍽️','Decoration':'🎀','Sound & Lighting':'🎵','Videography':'🎬','Photography':'📷','Gifts':'🎁','Transport':'🚗','Invitations':'📬','Sweets & Snacks':'🍬','Pooja Items':'🪔','DJ / Music':'🎧','Flowers':'🌸','Clothing':'👗','Miscellaneous':'📦','Food':'🍽️','Hotel':'🏨','Activities':'🎯','Shopping':'🛍️','Medical':'💊','Fuel':'⛽','Other':'📌'};

export default function PublicDashboard({ navigate, groupId }) {
  const [data, setData]     = useState(null);
  const [tally, setTally]   = useState(null);
  const [cats, setCats]     = useState([]);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Build the shareable URL for this group
  const shareUrl = `${window.location.origin}/view/${groupId}`;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); }
    catch { /* fallback */ const el = document.createElement('textarea'); el.value = shareUrl; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareWhatsApp = () => {
    const msg = `📊 View our group expenses live:\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const load = () => {
    if (!groupId) return;
    setLoadError(false);
    getGroupData(groupId).then(d => {
      setData(d);
      setTally(getFamilyTally(d.collections, d.expenses));
      setCats(getCategoryTotals(d.expenses));
    }).catch(() => setLoadError(true));
  };
  useEffect(load, [groupId]);

  if (loadError) return (
    <div className="screen">
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12, alignItems:'center', justifyContent:'center', color:'var(--text3)', padding:20, textAlign:'center' }}>
        <div>Couldn't load this group. Check your connection and try again.</div>
        <button className="btn btn-secondary" onClick={load}>Retry</button>
      </div>
    </div>
  );
  if (!data || !tally) return (
    <div className="screen">
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>Loading…</div>
    </div>
  );

  const { group, collections, expenses, members } = data;
  const isFamily = group?.type === 'family';
  const isSplitwise = group?.type === 'splitwise';
  const collectPct = tally.totalExpenses > 0 ? Math.min(100, (tally.totalCollected / tally.totalExpenses) * 100) : 100;
  const perPerson = members?.length > 0 ? tally.totalExpenses / members.length : 0;

  // "Who owes whom" — a per-person debt concept, so it doesn't apply to
  // Family groups (pooled contributions vs spending, not individual debts).
  const settleTxns = isFamily ? [] : calculateSettlements(
    isSplitwise
      ? calculateSplitwiseBalances(members, expenses, data.splitsMap, data.settlements)
      : calculateBalances(members, expenses, data.splitsMap, collections, group?.mode)
  );

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <button className="icon-btn" onClick={() => navigate('home')}>
          <ArrowLeft size={17}/>
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div className="header-title">{group?.name}</div>
          <div className="header-sub">Public View · Read Only</div>
        </div>
        <ThemeToggle/>
      </div>

      <div className="content">
        {/* TALLY CARD */}
        <div className="tally-card">
          <div className="tally-header">
            {isFamily ? (
              <div>
                <div className="tally-title">Balance</div>
                <div className={`tally-balance ${tally.isDeficit?'text-red':tally.isSurplus?'text-green':'text-accent'}`}>
                  {tally.isDeficit?'−':tally.isSurplus?'+':''}{fmt(tally.balance)}
                </div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
                  {tally.isDeficit ? '⚠️ Expenses exceed collections' : tally.isSurplus ? '✓ Surplus remaining' : '✓ Balanced'}
                </div>
              </div>
            ) : (
              <div>
                <div className="tally-title">Total Spent</div>
                <div className="tally-balance text-accent">{fmt(tally.totalExpenses)}</div>
              </div>
            )}
            <div style={{ textAlign:'right' }}>
              {isFamily ? (
                <>
                  <div className="tally-title">Coverage</div>
                  <div style={{ fontWeight:700, fontSize:22, color: collectPct>=100?'var(--green)':'var(--red)', marginTop:5, letterSpacing:'-0.03em' }}>
                    {Math.round(collectPct)}%
                  </div>
                </>
              ) : (
                <>
                  <div className="tally-title">Per Person</div>
                  <div style={{ fontWeight:700, fontSize:22, color:'var(--accent)', marginTop:5, letterSpacing:'-0.03em' }}>
                    {fmt(perPerson)}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="tally-rows">
            <div className="tally-row">
              <span className="tally-label">💰 Total Collected</span>
              <span className="tally-value text-green">{fmt(tally.totalCollected)}</span>
            </div>
            <div className="tally-row">
              <span className="tally-label">🧾 Total Expenses</span>
              <span className="tally-value text-accent">{fmt(tally.totalExpenses)}</span>
            </div>
          </div>
          <div className="tally-bar-wrap">
            <div className="tally-bar-label"><span>Spent</span><span>Collected</span></div>
            <div className="tally-bar-track">
              <div className="tally-bar-fill" style={{ width:`${collectPct}%`, background: collectPct>=100?'var(--green)':collectPct>=75?'var(--accent)':'var(--red)' }}/>
            </div>
          </div>
        </div>

        {/* WHO OWES WHOM */}
        {!isFamily && (
          <>
            <div className="section-title">Who Owes Whom</div>
            {settleTxns.length === 0 ? (
              <div className="card" style={{ textAlign:'center', padding:'24px 16px' }}>
                <div style={{ fontSize:36 }}>🎉</div>
                <div style={{ fontWeight:700, fontSize:15, marginTop:8 }}>All settled up!</div>
              </div>
            ) : (
              <div className="card" style={{ padding:'4px 18px' }}>
                {settleTxns.map((s, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom: i<settleTxns.length-1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ flex:1, fontSize:13 }}>
                      <strong>{s.from}</strong> <span style={{ color:'var(--text3)' }}>owes</span> <strong>{s.to}</strong>
                    </div>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--accent)' }}>{fmt(s.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* STAT PILLS */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          {[
            { label:'Collections', value: collections.length, icon:'📥', color:'var(--green)' },
            { label:'Expenses',    value: expenses.length,    icon:'🧾', color:'var(--accent)' },
            { label:'Categories',  value: cats.length,        icon:'📊', color:'var(--blue)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign:'center', padding:'14px 8px' }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontWeight:700, fontSize:20, color:s.color, letterSpacing:'-0.03em' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* CATEGORY BREAKDOWN */}
        {cats.length > 0 && (
          <>
            <div className="section-title">Expense Breakdown</div>
            <div className="card" style={{ padding:'4px 18px' }}>
              {cats.map(({ cat, total, count }) => {
                const pct = tally.totalExpenses > 0 ? (total / tally.totalExpenses * 100) : 0;
                return (
                  <div key={cat} style={{ padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <span style={{ fontSize:18 }}>{CAT_ICON[cat]||'📌'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{cat}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{count} item{count>1?'s':''}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{fmt(total)}</div>
                        <div style={{ fontSize:10, color:'var(--text3)' }}>{Math.round(pct)}%</div>
                      </div>
                    </div>
                    {/* Mini bar */}
                    <div style={{ height:3, background:'var(--surface3)', borderRadius:0, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:0, transition:'width .5s ease' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* RECENT COLLECTIONS */}
        {collections.length > 0 && (
          <>
            <div className="section-title">Collections ({collections.length})</div>
            {collections.slice(0,8).map(c => (
              <div key={c.id} className="entry-item">
                <div className="entry-icon" style={{ background:'var(--green-bg)', borderColor:'var(--green)' }}>💰</div>
                <div className="entry-body">
                  <div className="entry-title">{c.member_name}</div>
                  <div className="entry-meta">
                    <PaymentBadge mode={c.payment_mode}/>
                    {c.notes && <span>{c.notes}</span>}
                    <span>{fmtDate(c.date)}</span>
                  </div>
                </div>
                <div className="entry-amount text-green">{fmt(c.amount)}</div>
              </div>
            ))}
            {collections.length > 8 && (
              <div style={{ textAlign:'center', fontSize:12, color:'var(--text3)', padding:'4px 0' }}>
                + {collections.length - 8} more entries · Sign in to see all
              </div>
            )}
          </>
        )}

        {/* RECENT EXPENSES */}
        {expenses.length > 0 && (
          <>
            <div className="section-title">Expenses ({expenses.length})</div>
            {expenses.slice(0,8).map(e => (
              <div key={e.id} className="entry-item">
                <div className="entry-icon">{CAT_ICON[e.category]||'📌'}</div>
                <div className="entry-body">
                  <div className="entry-title">{e.notes||e.category}</div>
                  <div className="entry-meta">
                    <PaymentBadge mode={e.payment_mode}/>
                    <span>{e.category}</span>
                    <span>{fmtDate(e.date)}</span>
                  </div>
                </div>
                <div className="entry-amount text-accent">{fmt(e.amount)}</div>
              </div>
            ))}
            {expenses.length > 8 && (
              <div style={{ textAlign:'center', fontSize:12, color:'var(--text3)', padding:'4px 0' }}>
                + {expenses.length - 8} more · Sign in to see all
              </div>
            )}
          </>
        )}

        {collections.length === 0 && expenses.length === 0 && (
          <div className="empty">
            <div className="empty-icon">📊</div>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text2)', marginBottom:4 }}>Nothing yet</div>
            <div className="empty-text">No transactions recorded for this group</div>
          </div>
        )}

        {/* Sign in CTA */}
        <div className="card" style={{ textAlign:'center', background:'var(--accent-bg)', borderColor:'var(--accent)', padding:'20px 16px' }}>
          <div style={{ fontSize:13, color:'var(--text2)', marginBottom:12, lineHeight:1.6 }}>
            Want to add collections or expenses?
          </div>
          <button className="btn btn-primary" style={{ maxWidth:220, margin:'0 auto' }} onClick={() => navigate('home')}>
            Sign In to Edit
          </button>
        </div>

        {/* Share card — always shown, whether you're the owner viewing your
            own group's link or a visitor who arrived via that link. */}
        <div className="card" style={{ padding:'14px 16px' }}>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <Lock size={12}/> Read-only public view · <span style={{ color:'var(--accent)', cursor:'pointer', textDecoration:'underline' }} onClick={() => navigate('home')}>Sign in to edit</span>
          </div>
          <div style={{ fontFamily:'monospace', fontSize:12, color:'var(--text2)', background:'var(--surface2)', borderRadius:0, padding:'8px 10px', marginBottom:10, wordBreak:'break-all', border:'1px solid var(--border)' }}>
            {shareUrl}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-action btn-sm" style={{ flex:1, gap:6, fontSize:13 }} onClick={copyLink}>
              {copied ? <><Check size={14}/> Copied!</> : <><Copy size={14}/> Copy Link</>}
            </button>
            <button className="btn btn-action btn-sm" style={{ flex:1, gap:6, fontSize:13 }} onClick={shareWhatsApp}>
              <Share2 size={14}/> WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
