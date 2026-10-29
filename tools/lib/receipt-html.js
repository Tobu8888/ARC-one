'use strict';

/**
 * Renders withholding receipts as a printable page. Browsers print to PDF, so
 * this covers the PDF case without a PDF library.
 */

const escape = (v) => String(v ?? '').replace(/[&<>"]/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
));

module.exports = function receiptHtml(rows, { chain, gross, withheld, net, from, to }) {
  const period = from || to ? `${from || 'start'} to ${to || 'today'}` : 'all time';
  const body = rows.map((r) => `
      <tr>
        <td class="mono">${escape(r.receipt)}</td>
        <td>${escape(r.date)}</td>
        <td class="mono">${escape(r.payee)}</td>
        <td class="num">${r.gross_usdc.toFixed(2)}</td>
        <td class="num">${r.rate_percent}%</td>
        <td class="num">${r.withheld_usdc.toFixed(4)}</td>
        <td class="num">${r.net_usdc.toFixed(4)}</td>
        <td>${escape(r.memo)}</td>
        <td class="mono small"><a href="${escape(r.explorer)}">${escape(r.tx.slice(0, 10))}…</a></td>
      </tr>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Withholding receipts</title>
<style>
  body { font: 13px/1.45 system-ui, sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #555; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f4f4f5; font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: ui-monospace, monospace; }
  .small { font-size: 11px; }
  tfoot td { font-weight: 600; border-top: 2px solid #111; }
  .note { margin-top: 18px; color: #555; font-size: 12px; }
  @media print { body { margin: 12mm; } a { color: inherit; text-decoration: none; } }
</style>
</head>
<body>
  <h1>Withholding receipts</h1>
  <div class="meta">
    ${escape(chain.name)} · period ${escape(period)} · ${rows.length} payout(s)
  </div>
  <table>
    <thead>
      <tr>
        <th>Receipt</th><th>Date</th><th>Payee</th><th class="num">Gross</th>
        <th class="num">Rate</th><th class="num">Withheld</th><th class="num">Net</th>
        <th>Memo</th><th>Transaction</th>
      </tr>
    </thead>
    <tbody>${body}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3">Total</td>
        <td class="num">${gross.toFixed(2)}</td>
        <td></td>
        <td class="num">${withheld.toFixed(4)}</td>
        <td class="num">${net.toFixed(4)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>
  <p class="note">
    Amounts are USDC. Each row is a PayoutSent event and can be checked against the
    transaction linked beside it. This is a working paper for filing, not a filing:
    PND.53 is submitted through rd.go.th.
  </p>
</body>
</html>
`;
};
