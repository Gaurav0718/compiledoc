export function calculateBalances(members, expenses, participantsMap, collections, mode) {
  const map = {};
  members.forEach(m => { map[m.id] = { ...m, paid: 0, share: 0, collected: 0, balance: 0 }; });
  if (mode === 'audit') {
    collections.forEach(c => { if (c.member_id && map[c.member_id]) map[c.member_id].collected += c.amount; });
  }
  expenses.forEach(e => { if (e.paid_by && map[e.paid_by]) map[e.paid_by].paid += e.amount; });
  expenses.forEach(e => {
    const parts = (participantsMap && participantsMap[e.id]?.length)
      ? participantsMap[e.id] : Object.keys(map);
    if (!parts.length) return;
    const share = e.amount / parts.length;
    parts.forEach(mid => { if (map[mid]) map[mid].share += share; });
  });
  Object.values(map).forEach(m => {
    m.balance = mode === 'audit' ? m.collected - m.share : m.paid - m.share;
  });
  return Object.values(map);
}

// Splitwise-style balances: exact per-member shares (splitsMap) + recorded settle-up payments.
// Falls back to an equal split across all members when an expense has no recorded splits.
export function calculateSplitwiseBalances(members, expenses, splitsMap, settlements) {
  const map = {};
  members.forEach(m => { map[m.id] = { ...m, paid: 0, share: 0, balance: 0 }; });

  expenses.forEach(e => { if (e.paid_by && map[e.paid_by]) map[e.paid_by].paid += e.amount; });

  expenses.forEach(e => {
    const splits = splitsMap && splitsMap[e.id];
    if (splits && splits.length) {
      splits.forEach(({ member_id, share }) => { if (map[member_id]) map[member_id].share += share; });
    } else {
      const ids = Object.keys(map);
      if (!ids.length) return;
      const share = e.amount / ids.length;
      ids.forEach(mid => { map[mid].share += share; });
    }
  });

  (settlements || []).forEach(s => {
    if (map[s.from_member]) map[s.from_member].balance += s.amount;
    if (map[s.to_member])   map[s.to_member].balance   -= s.amount;
  });

  Object.values(map).forEach(m => { m.balance += m.paid - m.share; });
  return Object.values(map);
}

export function calculateSettlements(balances) {
  const creditors = balances.filter(m => m.balance > 0.01).map(m => ({ ...m, rem: m.balance })).sort((a,b) => b.rem - a.rem);
  const debtors   = balances.filter(m => m.balance < -0.01).map(m => ({ ...m, rem: Math.abs(m.balance) })).sort((a,b) => b.rem - a.rem);
  const txns = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci], d = debtors[di];
    const amt = Math.min(c.rem, d.rem);
    if (amt > 0.01) txns.push({ from: d.name, to: c.name, amount: Math.round(amt * 100) / 100 });
    c.rem -= amt; d.rem -= amt;
    if (c.rem < 0.01) ci++;
    if (d.rem < 0.01) di++;
  }
  return txns;
}

export function getFamilyTally(collections, expenses) {
  const totalCollected = collections.reduce((s, c) => s + c.amount, 0);
  const totalExpenses  = expenses.reduce((s, e) => s + e.amount, 0);
  const balance        = totalCollected - totalExpenses;
  return {
    totalCollected: round(totalCollected),
    totalExpenses:  round(totalExpenses),
    balance:        round(balance),
    isDeficit:      balance < -0.5,
    isSurplus:      balance > 0.5,
    isBalanced:     Math.abs(balance) <= 0.5,
  };
}

export function getMismatches(collections, expenses, tally) {
  const warnings = [];
  if (tally.isDeficit) warnings.push({ type: 'danger', msg: `Expenses exceed collections by ₹${fmt(Math.abs(tally.balance))}. You need more contributions!` });
  const expMap = {};
  expenses.forEach(e => { const k = `${e.amount}_${e.category}`; expMap[k] = (expMap[k]||0)+1; });
  Object.entries(expMap).forEach(([key, count]) => {
    if (count > 1) {
      const [amt, cat] = key.split('_');
      warnings.push({ type: 'warn', msg: `Possible duplicate: ₹${fmt(amt)} in "${cat}" appears ${count} times.` });
    }
  });
  if (tally.isSurplus && tally.balance > 500) warnings.push({ type: 'info', msg: `₹${fmt(tally.balance)} surplus remaining. All expenses logged?` });
  return warnings;
}

export function getCategoryTotals(expenses) {
  const map = {};
  expenses.forEach(e => {
    if (!map[e.category]) map[e.category] = { cat: e.category, total: 0, count: 0 };
    map[e.category].total += e.amount;
    map[e.category].count++;
  });
  return Object.values(map).sort((a,b) => b.total - a.total);
}

function round(n) { return Math.round(n * 100) / 100; }
function fmt(n) { return Number(n).toLocaleString('en-IN'); }

export const TRIP_CATEGORIES = ['Food','Transport','Hotel','Activities','Shopping','Medical','Fuel','Other'];
export const FAMILY_CATEGORIES = ['Venue','Catering','Decoration','Sound & Lighting','Videography','Photography','Gifts','Transport','Invitations','Sweets & Snacks','Pooja Items','DJ / Music','Flowers','Clothing','Miscellaneous'];
export const PAYMENT_MODES = ['Cash','GPay','PhonePe','Paytm','Bank Transfer','Cheque','Other'];
