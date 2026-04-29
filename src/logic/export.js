import * as XLSX from 'xlsx';

// DD-MM-YYYY  e.g. 26-12-2025  → for Excel
function fmtXLSX(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  return `${dd}-${mm}-${dt.getFullYear()}`;
}

// DD-Mon-YYYY  e.g. 26 Dec 2025  → for PDF
function fmtPDF(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(dt.getDate()).padStart(2,'0');
  return `${dd} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function exportXLSX(groupName, collections, expenses, tally, members) {
  const wb = XLSX.utils.book_new();
  const summaryData = [
    ['CompileDoc – Financial Report'],
    ['Group:', groupName],
    ['Exported:', fmtXLSX(new Date().toISOString().split('T')[0])],
    [],
    ['SUMMARY'],
    ['Total Collected', tally.totalCollected],
    ['Total Expenses', tally.totalExpenses],
    ['Balance', tally.balance],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  const collData = [
    ['#', 'Contributor', 'Amount (₹)', 'Payment Mode', 'Notes', 'Date'],
    ...collections.map((c,i) => [i+1, c.member_name, c.amount, c.payment_mode||'Cash', c.notes||'', fmtXLSX(c.date)]),
    [],['','TOTAL', collections.reduce((s,c)=>s+c.amount,0),'','','']
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(collData);
  ws2['!cols'] = [{ wch:5 },{ wch:25 },{ wch:15 },{ wch:16 },{ wch:30 },{ wch:14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Collections');

  const expData = [
    ['#', 'Category', 'Description', 'Amount (₹)', 'Payment Mode', 'Date'],
    ...expenses.map((e,i) => [i+1, e.category, e.notes||'', e.amount, e.payment_mode||'Cash', fmtXLSX(e.date)]),
    [],['','','TOTAL', expenses.reduce((s,e)=>s+e.amount,0),'','']
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(expData);
  ws3['!cols'] = [{ wch:5 },{ wch:22 },{ wch:35 },{ wch:15 },{ wch:16 },{ wch:14 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Expenses');

  if (members?.length) {
    const mData = [['#','Name','Role'], ...members.map((m,i)=>[i+1,m.name,m.role])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mData), 'Members');
  }
  XLSX.writeFile(wb, `${groupName.replace(/\s+/g,'_')}_CompileDoc.xlsx`);
}

export function exportPDF(groupName, collections, expenses, tally) {
  const fmt = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const date = fmtPDF(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'});
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head>
    <title>${groupName} – CompileDoc Report</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;font-size:13px;padding:32px;color:#111;line-height:1.6}
      h1{font-size:22px;font-weight:700;margin-bottom:4px}
      .meta{color:#666;font-size:12px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th{text-align:left;padding:8px 10px;background:#f4f4f4;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
      td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px}
      .amount{text-align:right;font-weight:600}
      .total-row td{font-weight:700;background:#fafafa;border-top:2px solid #333}
      .summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:18px 0}
      .box{border:1px solid #ddd;padding:14px;border-radius:8px}
      .box .label{font-size:10px;color:#888;text-transform:uppercase}
      .box .value{font-size:20px;font-weight:700;margin-top:4px}
      .deficit{color:#c0392b}.surplus{color:#27ae60}
      h2{font-size:14px;margin:24px 0 8px;border-bottom:2px solid #333;padding-bottom:4px}
      @media print{body{padding:16px}}
    </style></head><body>
    <h1>CompileDoc – Financial Report</h1>
    <div class="meta">Group: <strong>${groupName}</strong> | Generated: ${date}</div>
    <div class="summary">
      <div class="box"><div class="label">Total Collected</div><div class="value">${fmt(tally.totalCollected)}</div></div>
      <div class="box"><div class="label">Total Expenses</div><div class="value">${fmt(tally.totalExpenses)}</div></div>
      <div class="box"><div class="label">Balance</div><div class="value ${tally.isDeficit?'deficit':'surplus'}">${fmt(Math.abs(tally.balance))} ${tally.isDeficit?'▼ Deficit':'▲ Surplus'}</div></div>
    </div>
    <h2>Collections (${collections.length} entries)</h2>
    <table><tr><th>#</th><th>Contributor</th><th>Payment</th><th>Notes</th><th class="amount">Amount</th><th>Date</th></tr>
    ${collections.map((c,i)=>`<tr><td>${i+1}</td><td>${c.member_name}</td><td>${c.payment_mode||'Cash'}</td><td>${c.notes||'—'}</td><td class="amount">${fmt(c.amount)}</td><td style="white-space:nowrap">${fmtPDF(c.date)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="4">TOTAL</td><td class="amount">${fmt(tally.totalCollected)}</td><td></td></tr></table>
    <h2>Expenses (${expenses.length} entries)</h2>
    <table><tr><th>#</th><th>Category</th><th>Payment</th><th>Description</th><th class="amount">Amount</th><th>Date</th></tr>
    ${expenses.map((e,i)=>`<tr><td>${i+1}</td><td>${e.category}</td><td>${e.payment_mode||'Cash'}</td><td>${e.notes||'—'}</td><td class="amount">${fmt(e.amount)}</td><td style="white-space:nowrap">${fmtPDF(e.date)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="3">TOTAL</td><td class="amount" colspan="2">${fmt(tally.totalExpenses)}</td><td></td></tr></table>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}
