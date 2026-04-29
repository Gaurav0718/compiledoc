import React, { useState, useEffect, useRef } from 'react';
import { PAYMENT_MODES, FAMILY_CATEGORIES, TRIP_CATEGORIES } from '../logic/calculations';
import { PaymentBadge } from './ui';
import { Camera, X, Calendar } from 'lucide-react';

const CAT_ICON = {
  'Venue':'🏛️','Catering':'🍽️','Decoration':'🎀','Sound & Lighting':'🎵',
  'Videography':'🎬','Photography':'📷','Gifts':'🎁','Transport':'🚗',
  'Invitations':'📬','Sweets & Snacks':'🍬','Pooja Items':'🪔','DJ / Music':'🎧',
  'Flowers':'🌸','Clothing':'👗','Miscellaneous':'📦',
  'Food':'🍽️','Hotel':'🏨','Activities':'🎯','Shopping':'🛍️',
  'Medical':'💊','Fuel':'⛽','Other':'📌',
};

export default function TransactionForm({ type, groupType, members, initial, onSave, onCancel }) {
  // 'collection' or 'expense'
  const isCollection = type === 'collection';
  const isFamily     = groupType === 'family';

  const today = new Date().toISOString().split('T')[0];

  const [amount,      setAmount]      = useState(initial?.amount?.toString() || '');
  const [memberName,  setMemberName]  = useState(initial?.member_name || '');
  const [paidBy,      setPaidBy]      = useState(initial?.paid_by || (members[0]?.id || ''));
  const [category,    setCategory]    = useState(initial?.category || '');
  const [customCat,   setCustomCat]   = useState('');
  const [showCustom,  setShowCustom]  = useState(false);
  const [notes,       setNotes]       = useState(initial?.notes || '');
  const [payMode,     setPayMode]     = useState(initial?.payment_mode || 'Cash');
  const [date,        setDate]        = useState(initial?.date || today);
  const [proofImage,  setProofImage]  = useState(initial?.proof_image || null);
  const [participants, setParticipants] = useState([]);
  const [error,       setError]       = useState('');
  const fileRef = useRef();

  const cats = isFamily ? FAMILY_CATEGORIES : TRIP_CATEGORIES;
  useEffect(() => {
    if (!category && !initial) setCategory(cats[0]);
    if (!isCollection && members.length) setParticipants(members.map(m => m.id));
  }, []);

  const togglePart = (id) => setParticipants(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);

  const handleProof = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProofImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount'); return; }
    if (isCollection && !memberName.trim()) { setError('Enter contributor name'); return; }
    const cat = showCustom ? customCat.trim() : category;
    if (!isCollection && !cat) { setError('Select a category'); return; }

    onSave({
      amount: parseFloat(amount),
      member_name:  isCollection ? memberName.trim() : undefined,
      paid_by:      !isCollection ? paidBy : undefined,
      category:     !isCollection ? cat : undefined,
      notes,
      payment_mode: payMode,
      date,
      proof_image:  proofImage,
      participant_ids: !isCollection && !isFamily ? participants : undefined,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Amount */}
      <div className="input-group">
        <div className="input-label">Amount (₹)</div>
        <input className="input input-big" type="number" placeholder="0"
          value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} autoFocus />
      </div>

      {/* Collection: name */}
      {isCollection && (
        <div className="input-group">
          <div className="input-label">Contributor</div>
          {members.length > 0 && (
            <div className="filter-row" style={{ marginBottom: 6 }}>
              {members.map(m => (
                <button key={m.id} className={`filter-chip ${memberName===m.name?'active':''}`}
                  onClick={() => setMemberName(m.name)}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
          <input className="input" placeholder="Name (e.g. Ravi Uncle)"
            value={memberName} onChange={e => { setMemberName(e.target.value); setError(''); }} />
        </div>
      )}

      {/* Expense: category */}
      {!isCollection && (
        <div className="input-group">
          <div className="input-label">Category</div>
          <div className="cat-grid">
            {cats.map(cat => (
              <button key={cat} className={`cat-btn ${category===cat&&!showCustom?'active':''}`}
                onClick={() => { setCategory(cat); setShowCustom(false); }}>
                <span className="cat-btn-icon">{CAT_ICON[cat]||'📌'}</span>
                <span className="cat-btn-label">{cat}</span>
              </button>
            ))}
            <button className={`cat-btn ${showCustom?'active':''}`} onClick={() => setShowCustom(true)}>
              <span className="cat-btn-icon">✏️</span>
              <span className="cat-btn-label">Custom</span>
            </button>
          </div>
          {showCustom && (
            <input className="input" placeholder="e.g. Mandap, Fireworks, Band"
              value={customCat} onChange={e => setCustomCat(e.target.value)} autoFocus />
          )}
        </div>
      )}

      {/* Expense trip: paid by + participants */}
      {!isCollection && !isFamily && (
        <>
          <div className="input-group">
            <div className="input-label">Paid By</div>
            <select className="input" value={paidBy} onChange={e => setPaidBy(parseInt(e.target.value))}>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="input-group">
            <div className="input-label">Split Among</div>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setParticipants(members.map(m=>m.id))}>All</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setParticipants([])}>None</button>
            </div>
            {members.map(m => (
              <div key={m.id} className={`member-item ${participants.includes(m.id)?'selected':''}`}
                onClick={() => togglePart(m.id)} style={{ marginBottom:6 }}>
                <div className="avatar avatar-sm">{m.name[0].toUpperCase()}</div>
                <div style={{ flex:1, fontSize:14, fontWeight:500 }}>{m.name}</div>
                <div className={`check-ring ${participants.includes(m.id)?'on':''}`}>
                  {participants.includes(m.id) && <span style={{ fontSize:12 }}>✓</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Notes */}
      <div className="input-group">
        <div className="input-label">Description (optional)</div>
        <input className="input" placeholder={isCollection ? 'e.g. Cash in hand, Paid online' : 'e.g. Hired for 6 hrs, Full day'}
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {/* Payment mode */}
      <div className="input-group">
        <div className="input-label">Payment Mode</div>
        <div className="filter-row">
          {PAYMENT_MODES.map(pm => (
            <button key={pm} className={`filter-chip ${payMode===pm?'active':''}`} onClick={() => setPayMode(pm)}>
              {pm}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="input-group">
        <div className="input-label">Date</div>
        <div style={{ position: 'relative' }}>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)}
            style={{ paddingRight: 40 }} />
          <Calendar size={16} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
        </div>
      </div>

      {/* Payment proof */}
      <div className="input-group">
        <div className="input-label">Payment Proof (optional)</div>
        {proofImage ? (
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <img src={proofImage} alt="proof" className="proof-thumb" onClick={() => window.open(proofImage,'_blank')} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:'var(--green)', fontWeight:600 }}>✓ Proof attached</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>Tap image to view full size</div>
            </div>
            <button onClick={() => setProofImage(null)} style={{ background:'none',border:'none',color:'var(--red)',cursor:'pointer',padding:4,borderRadius:8,display:'flex',alignItems:'center' }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="proof-upload" onClick={() => fileRef.current?.click()}>
            <Camera size={18} />
            <span>Upload screenshot or photo</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleProof} />
      </div>

      {error && (
        <div style={{ fontSize:13, color:'var(--red)', textAlign:'center', background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:10, padding:'9px 14px' }}>
          {error}
        </div>
      )}

      <button className="btn btn-primary" onClick={handleSubmit}>
        {initial ? '✓ Update' : `✓ Save ${isCollection ? 'Collection' : 'Expense'}`}
      </button>
      <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
    </div>
  );
}
