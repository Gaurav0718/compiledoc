# CompileDoc — Deployment Guide
## Free tier · No domain needed · ~20 minutes total

---

## PART 1 — Set Up Supabase (Database)

### Step 1 · Create Supabase account
1. Go to https://supabase.com
2. Click "Start your project" → Sign up with GitHub (easiest)
3. Create a new organization (free)

### Step 2 · Create a new project
1. Click "New Project"
2. Name it: `compiledoc`
3. Set a strong database password (save it somewhere)
4. Region: Choose `South Asia (Mumbai)` for India
5. Click "Create new project" — wait ~2 minutes

### Step 3 · Run the database schema
1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click "New query"
3. Paste the entire SQL below and click "Run":

```sql
-- USERS
create table if not exists users (
  user_id           text primary key,
  display_name      text not null,
  pin_hash          text not null,
  mobile            text default '',
  security_question text default '',
  security_answer   text default '',
  created_at        timestamptz default now()
);

-- GROUPS
create table if not exists groups (
  group_id   text primary key,
  owner_id   text not null references users(user_id),
  owner_name text default '',
  name       text not null,
  type       text not null default 'family',
  mode       text not null default 'family',
  created_at timestamptz default now()
);

-- MEMBERS
create table if not exists members (
  member_id      text primary key,
  group_id       text not null references groups(group_id) on delete cascade,
  name           text not null,
  role           text not null default 'member',
  participant_id text not null,
  created_at     timestamptz default now()
);

-- EXPENSES
create table if not exists expenses (
  expense_id   text primary key,
  group_id     text not null references groups(group_id) on delete cascade,
  created_by   text not null,
  amount       numeric not null,
  paid_by      text default '',
  category     text not null,
  notes        text default '',
  payment_mode text default 'Cash',
  proof_image  text,
  date         date not null,
  created_at   timestamptz default now(),
  deleted      boolean default false
);

-- COLLECTIONS
create table if not exists collections (
  collection_id text primary key,
  group_id      text not null references groups(group_id) on delete cascade,
  created_by    text not null,
  member_name   text not null,
  amount        numeric not null,
  notes         text default '',
  payment_mode  text default 'Cash',
  proof_image   text,
  date          date not null,
  created_at    timestamptz default now(),
  deleted       boolean default false
);

-- AUDIT LOGS
create table if not exists audit_logs (
  id          bigserial primary key,
  group_id    text not null,
  changed_by  text,
  action      text,
  entity      text,
  detail      text,
  created_at  timestamptz default now()
);

-- SPLIT EXPENSES ("Splitwise-style" group type) ─────────────────────────────
-- Groups can now be closed/reopened (read-only when closed)
alter table groups add column if not exists closed boolean not null default false;

-- Exact per-member share of an expense (equal / unequal / percentage splits)
create table if not exists expense_splits (
  id         bigserial primary key,
  expense_id text not null references expenses(expense_id) on delete cascade,
  member_id  text not null,
  share      numeric not null,
  created_at timestamptz default now()
);

-- Recorded "settle up" payments between two members
create table if not exists settlements (
  settlement_id text primary key,
  group_id      text not null references groups(group_id) on delete cascade,
  from_member   text not null,
  to_member     text not null,
  amount        numeric not null,
  notes         text default '',
  date          date not null,
  created_by    text not null,
  created_at    timestamptz default now(),
  deleted       boolean not null default false
);

-- INDEXES for performance
create index if not exists idx_groups_owner      on groups(owner_id);
create index if not exists idx_members_group     on members(group_id);
create index if not exists idx_members_pid       on members(participant_id);
create index if not exists idx_expenses_group    on expenses(group_id);
create index if not exists idx_collections_group on collections(group_id);
create index if not exists idx_audit_group       on audit_logs(group_id);
create index if not exists idx_splits_expense    on expense_splits(expense_id);
create index if not exists idx_settlements_group on settlements(group_id);

-- ROW LEVEL SECURITY (public read for view links, auth write)
-- For simplicity with the offline PIN system, we use anon key with RLS disabled.
-- In production you'd enable RLS. For now:
alter table users           enable row level security;
alter table groups          enable row level security;
alter table members         enable row level security;
alter table expenses        enable row level security;
alter table collections     enable row level security;
alter table audit_logs      enable row level security;
alter table expense_splits  enable row level security;
alter table settlements     enable row level security;

-- Allow full access via anon key (you control access in app logic)
create policy "allow_all" on users           for all using (true) with check (true);
create policy "allow_all" on groups          for all using (true) with check (true);
create policy "allow_all" on members         for all using (true) with check (true);
create policy "allow_all" on expenses        for all using (true) with check (true);
create policy "allow_all" on collections     for all using (true) with check (true);
create policy "allow_all" on audit_logs      for all using (true) with check (true);
create policy "allow_all" on expense_splits  for all using (true) with check (true);
create policy "allow_all" on settlements     for all using (true) with check (true);
```

4. You should see "Success. No rows returned."

**Already have an older Supabase project?** Existing installs only need the new block above — run it once in the SQL Editor to add `groups.closed`, `expense_splits`, and `settlements` alongside your existing tables. It's all `if not exists` / `add column if not exists`, so it's safe to run even if some of it already exists.

### Step 4 · Get your API keys
1. Go to Settings → API in the left sidebar
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## PART 2 — Configure the App

### Step 5 · Create .env file
In the `expense-app` folder, create a file called `.env`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-full-key...
```

### Step 6 · Test locally
```bash
cd expense-app
npm install
npm run dev
```
Open http://localhost:5173 — create an account, verify data appears in Supabase dashboard (Table Editor → users table).

---

## PART 3 — Deploy to Vercel (Free, No Domain)

### Step 7 · Push to GitHub
```bash
# In the expense-app folder:
git init
git add .
git commit -m "CompileDoc v1"
git branch -M main

# Create a GitHub repo at https://github.com/new (name: compiledoc)
# Then:
git remote add origin https://github.com/YOUR_USERNAME/compiledoc.git
git push -u origin main
```

### Step 8 · Deploy on Vercel
1. Go to https://vercel.com → Sign up with GitHub (free)
2. Click "Add New Project"
3. Import your `compiledoc` GitHub repo
4. Framework preset: **Vite**
5. Build command: `npm run build`
6. Output directory: `dist`
7. **Environment Variables** — Add these:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON` = your anon key
8. Click "Deploy"

### Step 9 · Your live URL
After ~2 minutes you get a URL like:
```
https://compiledoc-gaurav.vercel.app
```
Share this with anyone. Free forever on Vercel's free tier.

---

## PART 4 — Shareable View Links

Every group has a public view link:
```
https://compiledoc-gaurav.vercel.app/view/GROUP_ID
```

- No login needed
- Shows live data (collections, expenses, tally)
- Safe to share in WhatsApp groups
- Copy the link from the "🔗 Link" button on the home screen

---

## PART 5 — Cross-Device Login

Once deployed, any device can login:
1. Open `https://compiledoc-gaurav.vercel.app` on mobile
2. Sign in with your User ID (e.g. `gaurav_98765`) and PIN
3. All data syncs from Supabase instantly

---

## FREE TIER LIMITS (Supabase)

| Resource              | Free Limit           | Your Usage (estimate)     |
|-----------------------|----------------------|---------------------------|
| Database rows         | 500MB storage        | 10,000 transactions ≈ 5MB |
| Monthly active users  | Unlimited on free    | ✅ No limit               |
| API requests          | 500,000/month        | ✅ More than enough        |
| Proof image storage   | 1GB                  | ~500 photos ≈ 100MB       |
| Bandwidth             | 5GB/month            | ✅ Fine for small groups   |

**Vercel free tier:** 100GB bandwidth, unlimited deployments, custom domain supported.

---

## PARTICIPANT ACCOUNT SETUP FLOW

When you add someone to a group in Admin Panel:
1. Their **Participant ID** is shown (e.g. `priya_4821`) — copy and share with them via WhatsApp
2. They open the app on their phone
3. Click **"New Participant"** on the login screen
4. Enter their Participant ID → set PIN + security question
5. They can now see all group data and their role (admin or viewer)

---

## USER ID FORMAT

User IDs follow the format: `firstname_12345`
- `firstname` = first letters of their name (lowercase, no spaces)
- `12345` = first 5 digits of their mobile number

Examples:
- Gaurav, mobile 9876543210 → `gaurav_98765`
- Priya Sharma, mobile 9123456789 → `priya_91234`

This makes IDs predictable and easy to remember.
