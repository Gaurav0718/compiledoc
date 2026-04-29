# XPENSE – Group Expense Manager

A fully offline-first PWA for tracking group trip expenses, splitting fairly, and settling debts.

## Features
- ✅ Works 100% offline (IndexedDB + Service Worker)
- ✅ Two modes: Equal Split & Collect + Audit
- ✅ Minimum-transactions settlement algorithm
- ✅ WhatsApp share
- ✅ Category filters, per-person breakdown
- ✅ Installable as mobile app (PWA)

## Tech Stack
- React 18 + Vite
- Dexie.js (IndexedDB)
- vite-plugin-pwa (Service Worker)
- Lucide React icons

## Deploy in 2 minutes

### Vercel (recommended)
```bash
npm install -g vercel
vercel --prod
```

### Netlify
Drag & drop the `dist/` folder at netlify.com/drop

### Any static host
Upload contents of `dist/` folder

## Local Dev
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
# Output in dist/
```

## Screens
1. **Home** – Create trip or open recent
2. **Create Trip** – 3-step wizard (name → mode → members)
3. **Dashboard** – Summary card + quick actions
4. **Add Expense** – Amount, category grid, paid-by, participant selector
5. **Add Collection** – Record upfront payments (audit mode)
6. **Expense List** – Filterable list with delete
7. **Audit Report** – Per-person breakdown + category totals
8. **Settlement** – Tap to mark paid, WhatsApp share

