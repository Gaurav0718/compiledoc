/**
 * CompileDoc — Database
 * Offline-first: IndexedDB (Dexie) always works.
 * Online: Supabase syncs when VITE_SUPABASE_URL + VITE_SUPABASE_ANON are set.
 *
 * ALL returned objects include both the typed PK (member_id, expense_id …)
 * AND a plain `.id` alias so every screen works without changes.
 */
import Dexie from 'dexie';
import { supabase, isConfigured, sb } from './supabase.js';

// ─── LOCAL CACHE ──────────────────────────────────────────────────────────────
const cache = new Dexie('CompileDocCache_v3');
cache.version(1).stores({
  users:       'user_id',
  groups:      'group_id',
  members:     'member_id, group_id, participant_id',
  expenses:    'expense_id, group_id',
  collections: 'collection_id, group_id',
  audit_logs:  '++lid, group_id',
  sync_queue:  '++id, created_at',
  kv:          'k',
});
cache.version(2).stores({
  expense_splits: '++id, expense_id',
  settlements:    'settlement_id, group_id',
});

// If another tab has this DB open on an older schema, it blocks our version
// upgrade — release it so the upgrade can proceed instead of leaving this
// tab stuck reading/writing a stale schema that's missing new tables.
cache.on('versionchange', () => cache.close());
// If we're the tab whose upgrade got blocked by another stale tab, surface
// it via a reload rather than silently leaving the schema half-upgraded.
cache.on('blocked', () => { try { window.location.reload(); } catch {} });

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const online  = () => navigator.onLine && isConfigured();
const today   = () => new Date().toISOString().split('T')[0];
const newId   = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function enqueue(table, op, data) {
  await cache.sync_queue.add({
    table, op, data: JSON.stringify(data), created_at: Date.now()
  }).catch(() => {});
}

// Add .id alias to every record so screens never need to know the PK name
const withId = {
  group:  g => g ? { ...g, id: g.group_id      ?? g.id } : null,
  member: m => m ? { ...m, id: m.member_id     ?? m.id } : null,
  exp:    e => e ? { ...e, id: e.expense_id    ?? e.id } : null,
  coll:   c => c ? { ...c, id: c.collection_id ?? c.id } : null,
  log:    l => l ? { ...l, id: l.lid           ?? l.id ?? Math.random() } : null,
  user:   u => u ? { ...u, uid: u.user_id ?? u.uid, displayName: u.display_name ?? u.displayName } : null,
  settle: s => s ? { ...s, id: s.settlement_id  ?? s.id } : null,
};

// ─── USER ID FORMAT ───────────────────────────────────────────────────────────
// Standard: firstname_12345  (name + first 5 digits of mobile)
export function generateUserId(name, mobile) {
  const n = (name || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 10) || 'user';
  const m = (mobile || '').replace(/\D/g, '');
  const d = m.slice(0, 5) || String(Math.floor(10000 + Math.random() * 90000));
  return `${n}_${d}`;
}

// Participant ID for group members: name_XXXX
export function generateParticipantId(name) {
  const n = (name || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 8) || 'user';
  return `${n}_${Math.floor(1000 + Math.random() * 9000)}`;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export async function registerUser({ username, pin, displayName, securityQuestion, securityAnswer }) {
  const user_id = username.toLowerCase().trim();
  if (!user_id) throw new Error('Username is required');
  if (!pin || pin.length !== 4) throw new Error('PIN must be 4 digits');

  const rec = {
    user_id,
    display_name:      displayName.trim(),
    pin_hash:          pin.trim(),
    security_question: securityQuestion || '',
    security_answer:   (securityAnswer || '').toLowerCase().trim(),
    created_at:        new Date().toISOString(),
  };

  if (online()) {
    const { data: ex } = await sb(s =>
      s.from('users').select('user_id').eq('user_id', user_id).maybeSingle()
    );
    if (ex) throw new Error('User ID already taken. Try a different name or mobile.');
    const { error } = await sb(s => s.from('users').insert(rec));
    if (error) throw new Error(error.message);
  } else {
    const ex = await cache.users.get(user_id);
    if (ex) throw new Error('User ID already taken.');
    await enqueue('users', 'insert', rec);
  }
  await cache.users.put(rec).catch(() => {});
  return withId.user(rec);
}

export async function loginUser({ username, pin }) {
  const user_id = username.toLowerCase().trim();
  if (!user_id) throw new Error('Enter your User ID');

  let user = null;
  if (online()) {
    const { data } = await sb(s =>
      s.from('users').select('*').eq('user_id', user_id).maybeSingle()
    );
    if (data) {
      await cache.users.put(data).catch(() => {});
      user = data;
    }
  }
  if (!user) user = await cache.users.get(user_id);
  if (!user) throw new Error('User not found. Check your User ID.');
  if (user.pin_hash !== pin.trim()) throw new Error('Incorrect PIN');
  return withId.user(user);
}

export async function setupParticipantAccount({ participant_id, ...rest }) {
  return registerUser({ username: participant_id, ...rest });
}

export async function participantHasAccount(pid) {
  const id = (pid || '').toLowerCase().trim();
  if (online()) {
    const { data } = await sb(s =>
      s.from('users').select('user_id').eq('user_id', id).maybeSingle()
    );
    return !!data;
  }
  return !!(await cache.users.get(id));
}

// Looks up any registered account by its exact ID — global across the whole
// app, not scoped to groups the caller can already see. Lets an admin add
// someone who already has an account (e.g. from a friend's group) as a
// member using their real ID, instead of minting a duplicate profile.
export async function findUserById(pid) {
  const id = (pid || '').toLowerCase().trim();
  if (!id) return null;
  let user = null;
  if (online()) {
    const { data } = await sb(s =>
      s.from('users').select('user_id,display_name').eq('user_id', id).maybeSingle()
    );
    user = data;
  }
  if (!user) user = await cache.users.get(id);
  return user ? { participant_id: user.user_id, name: user.display_name || user.user_id } : null;
}

export async function getSecurityQuestion(username) {
  const user_id = username.toLowerCase().trim();
  let user = null;
  if (online()) {
    const { data } = await sb(s =>
      s.from('users').select('security_question').eq('user_id', user_id).maybeSingle()
    );
    user = data;
  }
  if (!user) user = await cache.users.get(user_id);
  if (!user) throw new Error('User not found');
  if (!user.security_question) throw new Error('No security question set for this account');
  return user.security_question;
}

export async function resetPin({ username, securityAnswer, newPin }) {
  const user_id = username.toLowerCase().trim();
  if (!newPin || newPin.length !== 4) throw new Error('New PIN must be 4 digits');

  let user = null;
  if (online()) {
    const { data } = await sb(s =>
      s.from('users').select('security_answer').eq('user_id', user_id).maybeSingle()
    );
    user = data;
  }
  if (!user) user = await cache.users.get(user_id);
  if (!user) throw new Error('User not found');
  if (user.security_answer !== securityAnswer.toLowerCase().trim())
    throw new Error('Incorrect answer');

  if (online()) {
    await sb(s => s.from('users').update({ pin_hash: newPin }).eq('user_id', user_id));
  }
  await cache.users.where('user_id').equals(user_id).modify({ pin_hash: newPin }).catch(() => {});
}

// ─── GROUPS ───────────────────────────────────────────────────────────────────
export async function createGroup({ uid, name, type, mode, creatorName }) {
  const group_id = newId();
  const rec = {
    group_id, owner_id: uid,
    owner_name: creatorName || uid,   // store display name for self-healing
    name, type, mode,
    created_at: new Date().toISOString()
  };
  if (online()) {
    const { error } = await sb(s => s.from('groups').insert(rec));
    if (error) throw new Error(error.message);
  } else {
    await enqueue('groups', 'insert', rec);
  }
  _log(group_id, uid, 'create', 'group', uid, `Created "${name}"`);
  await cache.groups.put(rec).catch(() => {});

  // Auto-add creator as admin member
  const member_id = newId();
  const memberRec = {
    member_id, group_id,
    name:           creatorName || uid,
    role:           'admin',
    participant_id: uid,
    active:         true,
    created_at:     new Date().toISOString()
  };
  if (online()) await sb(s => s.from('members').insert(memberRec)).catch(() => {});
  else await enqueue('members', 'insert', memberRec);
  await cache.members.put(memberRec).catch(() => {});

  return group_id;
}

export async function getGroup(group_id) {
  if (!group_id) return null;
  if (online()) {
    const { data } = await sb(s =>
      s.from('groups').select('*').eq('group_id', group_id).maybeSingle()
    );
    if (data) { await cache.groups.put(data).catch(() => {}); return withId.group(data); }
  }
  return withId.group(await cache.groups.get(group_id));
}

export async function getVisibleGroups(user) {
  if (!user) return [];
  const uid = user.user_id || user.uid || user.username || '';
  const pid = uid.toLowerCase().trim();

  let all = [];
  if (online()) {
    const [{ data: owned }, { data: memberRows }] = await Promise.all([
      sb(s => s.from('groups').select('*').eq('owner_id', uid).order('created_at', { ascending: false })),
      sb(s => s.from('members').select('group_id').eq('participant_id', pid)),
    ]);
    const memberGids = [...new Set((memberRows || []).map(m => m.group_id))];
    const { data: memberGroups } = memberGids.length
      ? await sb(s => s.from('groups').select('*').in('group_id', memberGids))
      : { data: [] };

    all = [...(owned || [])];
    for (const g of (memberGroups || []))
      if (!all.find(x => x.group_id === g.group_id)) all.push(g);

    for (const g of all) await cache.groups.put(g).catch(() => {});
  } else {
    all = await cache.groups.toArray().catch(() => {});
  }
  return all
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(withId.group);
}

export async function updateGroupName(group_id, name, by) {
  if (online()) {
    await sb(s => s.from('groups').update({ name }).eq('group_id', group_id));
  } else {
    await enqueue('groups', 'update', { group_id, name });
  }
  _log(group_id, by, 'edit', 'group', by, `Renamed to "${name}"`);
  await cache.groups.where('group_id').equals(group_id).modify({ name }).catch(() => {});
}

// ─── MEMBERS ──────────────────────────────────────────────────────────────────
// Pass an existing `participant_id` to reuse a known person's identity (so the
// same login can access every group they're added to) instead of minting a
// brand new one for a name that already exists elsewhere.
export async function addMember(group_id, uid, name, role = 'member', by = '', participant_id = null) {
  const pid = participant_id || generateParticipantId(name);
  // Re-adding someone who was previously removed from this exact group
  // reactivates their old record instead of minting a duplicate — keeps
  // their name attached to their expense/settlement history intact.
  const existing = await getMembers(group_id);
  const prior = existing.find(m => m.participant_id === pid && m.active === false);
  if (prior) {
    if (online()) {
      await sb(s => s.from('members').update({ active: true, role, name }).eq('member_id', prior.id));
    } else {
      await enqueue('members', 'update', { member_id: prior.id, active: true, role, name });
    }
    await cache.members.where('member_id').equals(prior.id).modify({ active: true, role, name }).catch(() => {});
    _log(group_id, uid, 'add', 'member', by || name, `Re-added "${name}" (${pid}) as ${role}`);
    return { id: prior.id, participant_id: pid };
  }
  const member_id = newId();
  const rec = { member_id, group_id, name, role, participant_id: pid, active: true, created_at: new Date().toISOString() };
  if (online()) {
    const { error } = await sb(s => s.from('members').insert(rec));
    if (error) throw new Error(error.message);
  } else {
    await enqueue('members', 'insert', rec);
  }
  await cache.members.put(rec).catch(() => {});
  _log(group_id, uid, 'add', 'member', by || name,
      `Added "${name}" (${pid}) as ${role}`);
  return { id: member_id, participant_id: pid };
}

// Every distinct person (by participant_id) the current user has ever added
// to any of their groups — used to power "existing member" autocomplete so
// admins can reuse a known person instead of minting a fresh profile each time.
export async function getKnownMembers(user) {
  const groups = await getVisibleGroups(user);
  const groupIds = groups.map(g => g.id);
  if (!groupIds.length) return [];

  let rows = [];
  if (online()) {
    const { data } = await sb(s => s.from('members').select('name,participant_id').in('group_id', groupIds));
    if (data) rows = data;
  }
  if (!rows.length) {
    rows = await cache.members.where('group_id').anyOf(groupIds).toArray().catch(() => []);
  }

  const uid = (user.user_id || user.uid || user.username || '').toLowerCase().trim();
  const seen = new Map();
  for (const m of rows) {
    if (!m.participant_id || m.participant_id.toLowerCase() === uid) continue; // skip self
    seen.set(m.participant_id, m.name); // last-seen name wins if it ever changed
  }
  return [...seen.entries()]
    .map(([participant_id, name]) => ({ participant_id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function removeMember(member_id, group_id, uid, by) {
  // Soft-delete: a hard delete would erase the member's name/id from the DB
  // entirely, so any share of an expense they still owed (or were owed)
  // becomes permanently unattributable — it just vanishes from the ledger's
  // total with no way to trace or display it. Deactivating instead keeps
  // their history intact for balance math and audit purposes; every place
  // that lets you pick/manage members filters to active ones only.
  if (online()) {
    await sb(s => s.from('members').update({ active: false }).eq('member_id', member_id));
  } else {
    await enqueue('members', 'update', { member_id, active: false });
  }
  _log(group_id, uid, 'delete', 'member', by, `Removed member`);
  await cache.members.where('member_id').equals(member_id).modify({ active: false }).catch(() => {});
}

export async function updateMemberRole(member_id, group_id, uid, role, by) {
  if (online()) {
    await sb(s => s.from('members').update({ role }).eq('member_id', member_id));
  } else {
    await enqueue('members', 'update', { member_id, role });
  }
  _log(group_id, uid, 'edit', 'member', by, `Role → ${role}`);
  await cache.members.where('member_id').equals(member_id).modify({ role }).catch(() => {});
}

export async function getMembers(group_id) {
  let rows = [];
  if (online()) {
    const { data } = await sb(s =>
      s.from('members').select('*').eq('group_id', group_id)
    );
    if (data) {
      rows = data;
      for (const m of rows) await cache.members.put(m).catch(() => {});
    }
  }
  if (!rows.length) {
    rows = await cache.members.where('group_id').equals(group_id).toArray().catch(() => []);
  }
  return rows.map(withId.member);
}

// ─── ADMIN CHECK ──────────────────────────────────────────────────────────────
export async function checkIsAdmin(group_id, user) {
  if (!user) return false;
  const group = await getGroup(group_id);
  const members = await getMembers(group_id);
  const admins = members.filter(m => m.role === 'admin');
  const uid = (user.user_id || user.uid || user.username || '').toLowerCase().trim();

  if ((group?.owner_id || '').toLowerCase() === uid) return true;   // owner is always admin
  if (admins.length === 0) return false;                            // no admins yet: owner-only, not everyone
  if (admins.some(a => (a.participant_id || '').toLowerCase().trim() === uid)) return true;
  const name = (user.display_name || user.displayName || '').toLowerCase().trim();
  if (name && admins.some(a => (a.name || '').toLowerCase().trim() === name)) return true;
  return false;
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
export async function addExpense({ group_id, uid, amount, paid_by, category, notes, payment_mode, proof_image, date, by, splits }) {
  const expense_id = newId();
  const rec = {
    expense_id, group_id, created_by: uid,
    amount: parseFloat(amount) || 0,
    paid_by: paid_by || '',
    category: category || 'Other',
    notes: notes || '',
    payment_mode: payment_mode || 'Cash',
    proof_image: proof_image || null,
    date: date || today(),
    created_at: new Date().toISOString(),
    deleted: false,
  };
  if (online()) {
    const { error } = await sb(s => s.from('expenses').insert(rec));
    if (error) throw new Error(error.message);
  } else {
    await enqueue('expenses', 'insert', rec);
  }
  // The local cache is just a mirror once the online write above has
  // succeeded — a stale/mismatched local schema shouldn't fail the save
  // itself (this is what surfaced as "Couldn't save" even though the
  // expense had already been written to the database).
  await cache.expenses.put(rec).catch(() => {});
  if (splits) await replaceExpenseSplits(expense_id, splits).catch(() => {});
  _log(group_id, uid, 'add', 'expense', by, `₹${amount} – ${category}`);
  return expense_id;
}

export async function updateExpense({ id, group_id, uid, amount, paid_by, category, notes, payment_mode, proof_image, date, by, splits }) {
  const expense_id = id; // id is the alias
  const upd = {
    amount: parseFloat(amount) || 0,
    paid_by: paid_by || '',
    category: category || 'Other',
    notes: notes || '',
    payment_mode: payment_mode || 'Cash',
    date: date || today(),
    ...(proof_image !== undefined ? { proof_image } : {}),
  };
  if (online()) {
    await sb(s => s.from('expenses').update(upd).eq('expense_id', expense_id));
  } else {
    await enqueue('expenses', 'update', { expense_id, ...upd });
  }
  _log(group_id, uid, 'edit', 'expense', by, `Edited ₹${amount}`);
  await cache.expenses.where('expense_id').equals(expense_id).modify(upd).catch(() => {});
  if (splits) await replaceExpenseSplits(expense_id, splits);
}

// ─── EXPENSE SPLITS (Splitwise-style exact per-member shares) ─────────────────
async function replaceExpenseSplits(expense_id, splits) {
  const rows = (splits || []).map(s => ({
    expense_id, member_id: s.member_id, share: parseFloat(s.share) || 0,
  }));
  if (online()) {
    await sb(s => s.from('expense_splits').delete().eq('expense_id', expense_id));
    if (rows.length) await sb(s => s.from('expense_splits').insert(rows));
  } else {
    await enqueue('expense_splits', 'delete', { expense_id });
    if (rows.length) await enqueue('expense_splits', 'insert', rows);
  }
  await cache.expense_splits.where('expense_id').equals(expense_id).delete().catch(() => {});
  for (const r of rows) await cache.expense_splits.add(r).catch(() => {});
}

export async function getExpenseSplits(expenseIds) {
  if (!expenseIds || !expenseIds.length) return {};
  let rows = [];
  if (online()) {
    const { data } = await sb(s => s.from('expense_splits').select('*').in('expense_id', expenseIds));
    if (data) {
      rows = data;
      for (const id of expenseIds) await cache.expense_splits.where('expense_id').equals(id).delete().catch(() => {});
      for (const r of rows) await cache.expense_splits.add(r).catch(() => {});
    }
  }
  if (!rows.length) {
    rows = await cache.expense_splits.where('expense_id').anyOf(expenseIds).toArray().catch(() => []);
  }
  const map = {};
  for (const r of rows) (map[r.expense_id] ||= []).push({ member_id: r.member_id, share: r.share });
  return map;
}

export async function deleteExpense(id, group_id, uid, by) {
  const expense_id = id;
  if (online()) {
    await sb(s => s.from('expenses').update({ deleted: true }).eq('expense_id', expense_id));
  } else {
    await enqueue('expenses', 'update', { expense_id, deleted: true });
  }
  _log(group_id, uid, 'delete', 'expense', by, `Deleted expense`);
  await cache.expenses.where('expense_id').equals(expense_id).modify({ deleted: true }).catch(() => {});
}

export async function getExpenses(group_id) {
  let rows = [];
  if (online()) {
    const { data } = await sb(s =>
      s.from('expenses').select('*')
        .eq('group_id', group_id).eq('deleted', false)
        .order('date', { ascending: false })
    );
    if (data) {
      rows = data;
      await cache.expenses.where('group_id').equals(group_id).delete().catch(() => {});
      for (const e of rows) await cache.expenses.put(e).catch(() => {});
    }
  }
  if (!rows.length) {
    rows = (await cache.expenses.where('group_id').equals(group_id).toArray().catch(() => []))
      .filter(e => !e.deleted);
  }
  return rows
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(withId.exp);
}

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────
export async function addCollection({ group_id, uid, member_name, amount, notes, payment_mode, proof_image, date, by }) {
  const collection_id = newId();
  const rec = {
    collection_id, group_id, created_by: uid,
    member_name: member_name || 'Unknown',
    amount: parseFloat(amount) || 0,
    notes: notes || '',
    payment_mode: payment_mode || 'Cash',
    proof_image: proof_image || null,
    date: date || today(),
    created_at: new Date().toISOString(),
    deleted: false,
  };
  if (online()) {
    const { error } = await sb(s => s.from('collections').insert(rec));
    if (error) throw new Error(error.message);
  } else {
    await enqueue('collections', 'insert', rec);
  }
  await cache.collections.put(rec).catch(() => {});
  _log(group_id, uid, 'add', 'collection', by || member_name,
      `₹${amount} from ${member_name}`);
  return collection_id;
}

export async function updateCollection({ id, group_id, uid, member_name, amount, notes, payment_mode, proof_image, date, by }) {
  const collection_id = id;
  const upd = {
    member_name: member_name || '',
    amount: parseFloat(amount) || 0,
    notes: notes || '',
    payment_mode: payment_mode || 'Cash',
    date: date || today(),
    ...(proof_image !== undefined ? { proof_image } : {}),
  };
  if (online()) {
    await sb(s => s.from('collections').update(upd).eq('collection_id', collection_id));
  } else {
    await enqueue('collections', 'update', { collection_id, ...upd });
  }
  _log(group_id, uid, 'edit', 'collection', by, `Edited ₹${amount}`);
  await cache.collections.where('collection_id').equals(collection_id).modify(upd).catch(() => {});
}

export async function deleteCollection(id, group_id, uid, by) {
  const collection_id = id;
  if (online()) {
    await sb(s => s.from('collections').update({ deleted: true }).eq('collection_id', collection_id));
  } else {
    await enqueue('collections', 'update', { collection_id, deleted: true });
  }
  _log(group_id, uid, 'delete', 'collection', by, `Deleted collection`);
  await cache.collections.where('collection_id').equals(collection_id).modify({ deleted: true }).catch(() => {});
}

export async function getCollections(group_id) {
  let rows = [];
  if (online()) {
    const { data } = await sb(s =>
      s.from('collections').select('*')
        .eq('group_id', group_id).eq('deleted', false)
        .order('date', { ascending: false })
    );
    if (data) {
      rows = data;
      await cache.collections.where('group_id').equals(group_id).delete().catch(() => {});
      for (const c of rows) await cache.collections.put(c).catch(() => {});
    }
  }
  if (!rows.length) {
    rows = (await cache.collections.where('group_id').equals(group_id).toArray().catch(() => []))
      .filter(c => !c.deleted);
  }
  return rows
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(withId.coll);
}

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
async function _log(group_id, uid, action, entity, changed_by, detail) {
  const now = Date.now();
  const rec = {
    group_id,
    changed_by: changed_by || 'System',
    action, entity, detail,
    timestamp:  now,                           // numeric for timeAgo()
    created_at: new Date(now).toISOString(),   // ISO for Supabase ordering
  };
  if (online()) await sb(s => s.from('audit_logs').insert(rec)).catch(() => {});
  await cache.audit_logs.add(rec).catch(() => {});
}

export async function getAuditLogs(group_id) {
  let rows = [];
  if (online()) {
    const { data } = await sb(s =>
      s.from('audit_logs').select('*')
        .eq('group_id', group_id)
        .order('created_at', { ascending: false })
    );
    if (data) rows = data;
  }
  if (!rows.length) {
    rows = (await cache.audit_logs.where('group_id').equals(group_id).toArray().catch(() => [])).reverse();
  }
  return rows.map(withId.log);
}

// ─── SETTLEMENTS (Splitwise-style "settle up" payments) ───────────────────────
export async function addSettlement({ group_id, uid, from_member, to_member, amount, notes, date, by }) {
  const settlement_id = newId();
  const rec = {
    settlement_id, group_id, created_by: uid,
    from_member, to_member,
    amount: parseFloat(amount) || 0,
    notes: notes || '',
    date: date || today(),
    created_at: new Date().toISOString(),
    deleted: false,
  };
  if (online()) {
    const { error } = await sb(s => s.from('settlements').insert(rec));
    if (error) throw new Error(error.message);
  } else {
    await enqueue('settlements', 'insert', rec);
  }
  await cache.settlements.put(rec).catch(() => {});
  _log(group_id, uid, 'add', 'settlement', by, `₹${amount} settled`);
  return settlement_id;
}

export async function deleteSettlement(id, group_id, uid, by) {
  const settlement_id = id;
  if (online()) {
    await sb(s => s.from('settlements').update({ deleted: true }).eq('settlement_id', settlement_id));
  } else {
    await enqueue('settlements', 'update', { settlement_id, deleted: true });
  }
  _log(group_id, uid, 'delete', 'settlement', by, `Removed a settlement`);
  await cache.settlements.where('settlement_id').equals(settlement_id).modify({ deleted: true }).catch(() => {});
}

export async function getSettlements(group_id) {
  let rows = [];
  if (online()) {
    const { data } = await sb(s =>
      s.from('settlements').select('*')
        .eq('group_id', group_id).eq('deleted', false)
        .order('date', { ascending: false })
    );
    if (data) {
      rows = data;
      await cache.settlements.where('group_id').equals(group_id).delete().catch(() => {});
      for (const r of rows) await cache.settlements.put(r).catch(() => {});
    }
  }
  if (!rows.length) {
    rows = (await cache.settlements.where('group_id').equals(group_id).toArray().catch(() => []))
      .filter(s => !s.deleted);
  }
  return rows
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(withId.settle);
}

// ─── CLOSE / REOPEN GROUP (Splitwise-style "close out") ───────────────────────
export async function closeGroup(group_id, closed, uid, by) {
  if (online()) {
    await sb(s => s.from('groups').update({ closed }).eq('group_id', group_id));
  } else {
    await enqueue('groups', 'update', { group_id, closed });
  }
  _log(group_id, uid, 'edit', 'group', by, closed ? 'Closed the group' : 'Reopened the group');
  await cache.groups.where('group_id').equals(group_id).modify({ closed }).catch(() => {});
}

// ─── FULL GROUP DATA ──────────────────────────────────────────────────────────
export async function getGroupData(group_id) {
  // settlements don't depend on expenses, so fetch them in the same round
  // trip instead of waiting for expenses to resolve first — only splits
  // need expense ids and have to wait.
  const [group, members, expenses, collections, settlements] = await Promise.all([
    getGroup(group_id),
    getMembers(group_id),
    getExpenses(group_id),
    getCollections(group_id),
    getSettlements(group_id),
  ]);

  // Self-heal: if group exists but has NO members, auto-add the owner as admin.
  // Repairs groups created before the auto-admin fix, or via old DB versions.
  if (group && members.length === 0 && group.owner_id) {
    const member_id = newId();
    const memberRec = {
      member_id,
      group_id,
      name:           group.owner_name || group.owner_id,
      role:           'admin',
      participant_id: group.owner_id,
      active:         true,
      created_at:     new Date().toISOString(),
    };
    if (online()) await sb(s => s.from('members').insert(memberRec)).catch(() => {});
    else await enqueue('members', 'insert', memberRec);
    await cache.members.put(memberRec).catch(() => {});
    members.push(withId.member(memberRec));
  }

  const splitsMap = await getExpenseSplits(expenses.map(e => e.id));

  return { group, members, expenses, collections, settlements, splitsMap };
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
export async function getSetting(uid, key, def = null) {
  try {
    const r = await cache.kv.get(`${uid}:${key}`);
    return r ? r.value : def;
  } catch { return def; }
}

export async function setSetting(uid, key, value) {
  try { await cache.kv.put({ k: `${uid}:${key}`, value }); } catch {}
}

// ─── OFFLINE SYNC FLUSH ───────────────────────────────────────────────────────
export async function flushSyncQueue() {
  if (!online()) return 0;
  const items = await cache.sync_queue.toArray().catch(() => {});
  let synced = 0;
  for (const item of items) {
    try {
      const data = JSON.parse(item.data);
      if (item.op === 'insert') {
        await sb(s => s.from(item.table).insert(data));
      } else if (item.op === 'update') {
        // Determine PK field: groups→group_id, members→member_id, etc.
        const pk = item.table.replace(/s$/, '') + '_id';
        if (data[pk]) await sb(s => s.from(item.table).update(data).eq(pk, data[pk]));
      } else if (item.op === 'delete') {
        const [k, v] = Object.entries(data)[0];
        await sb(s => s.from(item.table).delete().eq(k, v));
      }
      await cache.sync_queue.delete(item.id).catch(() => {});
      synced++;
    } catch {}
  }
  return synced;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', flushSyncQueue);
}

// ─── DELETE GROUP ─────────────────────────────────────────────────────────────
export async function deleteGroup(group_id, uid) {
  const expenseIds = (await cache.expenses.where('group_id').equals(group_id).primaryKeys().catch(() => [])).map(String);
  if (online()) {
    // Cascade delete all related data
    await sb(s => s.from('collections').delete().eq('group_id', group_id));
    await sb(s => s.from('settlements').delete().eq('group_id', group_id));
    await sb(s => s.from('expenses').delete().eq('group_id', group_id)); // expense_splits cascade via FK
    await sb(s => s.from('members').delete().eq('group_id', group_id));
    await sb(s => s.from('audit_logs').delete().eq('group_id', group_id));
    await sb(s => s.from('groups').delete().eq('group_id', group_id));
  } else {
    await enqueue('groups', 'delete', { group_id });
  }
  // Clear local cache
  await cache.collections.where('group_id').equals(group_id).delete().catch(() => {});
  await cache.settlements.where('group_id').equals(group_id).delete().catch(() => {});
  if (expenseIds.length) await cache.expense_splits.where('expense_id').anyOf(expenseIds).delete().catch(() => {});
  await cache.expenses.where('group_id').equals(group_id).delete().catch(() => {});
  await cache.members.where('group_id').equals(group_id).delete().catch(() => {});
  await cache.audit_logs.where('group_id').equals(group_id).delete().catch(() => {});
  await cache.groups.delete(group_id).catch(() => {});
}

// ─── UPDATE MEMBER NAME (for self-healing creator display name) ───────────────
export async function updateMemberName(member_id, name) {
  if (!member_id || !name) return;
  if (online()) {
    await sb(s => s.from('members').update({ name }).eq('member_id', member_id)).catch(() => {});
  }
  await cache.members.where('member_id').equals(member_id).modify({ name }).catch(() => {});
}

// ─── CUSTOM USER ID ───────────────────────────────────────────────────────────
// User can change their user_id. Updates: users table + all member.participant_id
// across all their groups.
export async function changeUserId({ oldUserId, newUserId, pin }) {
  const old_id = oldUserId.toLowerCase().trim();
  const new_id = newUserId.toLowerCase().trim();
  if (!new_id || new_id.length < 4) throw new Error('User ID must be at least 4 characters');
  if (!/^[a-z0-9_]+$/.test(new_id)) throw new Error('Only lowercase letters, numbers and _ allowed');

  // Verify PIN before allowing change
  const user = await loginUser({ username: old_id, pin });
  if (!user) throw new Error('Incorrect PIN');

  if (online()) {
    // Check new ID not taken
    const { data: ex } = await sb(s => s.from('users').select('user_id').eq('user_id', new_id).maybeSingle());
    if (ex) throw new Error('This User ID is already taken. Choose another.');

    // Update user record
    await sb(s => s.from('users').update({ user_id: new_id }).eq('user_id', old_id));
    // Update all member participant_id records
    await sb(s => s.from('members').update({ participant_id: new_id }).eq('participant_id', old_id));
    // Update all groups owned by this user
    await sb(s => s.from('groups').update({ owner_id: new_id }).eq('owner_id', old_id));
  } else {
    // Offline: check local cache
    const ex = await cache.users.get(new_id);
    if (ex) throw new Error('This User ID is already taken locally.');
    await enqueue('users', 'rename', { old_user_id: old_id, new_user_id: new_id });
  }

  // Update local cache
  const userData = await cache.users.get(old_id);
  if (userData) {
    await cache.users.delete(old_id).catch(() => {});
    await cache.users.put({ ...userData, user_id: new_id }).catch(() => {});
  }
  await cache.members.where('participant_id').equals(old_id).modify({ participant_id: new_id }).catch(() => {});
  await cache.groups.where('owner_id').equals(old_id).modify({ owner_id: new_id }).catch(() => {});

  return new_id;
}
