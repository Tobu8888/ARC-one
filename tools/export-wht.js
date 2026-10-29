'use strict';

/**
 * Exports withholding receipts for accounting.
 *
 *   node export-wht.js <network> <contract> [--sender 0x..] [--from YYYY-MM-DD]
 *                      [--to YYYY-MM-DD] [--csv out.csv] [--html out.html]
 *
 * Every row comes from a PayoutSent event, so the export can be checked against
 * the chain line by line. It is a working paper for filing, not a filing: PND.53
 * still goes through rd.go.th.
 */

const fs = require('fs');
const { chain } = require('./lib/arc');
const { load } = require('./lib/payouts');
const { stringify } = require('./lib/csv');

const COLUMNS = [
  'receipt', 'date', 'payer', 'payee', 'gross_usdc', 'rate_percent',
  'withheld_usdc', 'net_usdc', 'memo', 'tx', 'explorer',
];

function flag(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Positional arguments are the tokens that are neither a --flag nor its value. */
function positional(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { i++; continue; }
    out.push(argv[i]);
  }
  return out;
}

function summarise(rows) {
  const byPayee = new Map();
  for (const r of rows) {
    const cur = byPayee.get(r.payee) || { gross: 0, withheld: 0, net: 0, count: 0 };
    cur.gross += r.gross_usdc; cur.withheld += r.withheld_usdc; cur.net += r.net_usdc; cur.count += 1;
    byPayee.set(r.payee, cur);
  }
  return byPayee;
}

async function main() {
  const argv = process.argv.slice(2);
  const [network, contract] = positional(argv);
  if (!network || !contract) {
    console.error('usage: node export-wht.js <network> <contract> [--sender 0x..] [--from date] [--to date] [--csv file] [--html file]');
    process.exit(1);
  }

  const c = chain(network);
  const sender = flag(argv, 'sender');
  const from = flag(argv, 'from');
  const to = flag(argv, 'to');

  const { source, rows: events } = await load(network, contract);

  let rows = events.map((e) => ({
    receipt: e.receipt,
    date: e.date,
    payer: e.sender,
    payee: e.recipient,
    gross_usdc: e.gross,
    rate_percent: e.bps / 100,
    withheld_usdc: e.withheld,
    net_usdc: e.net,
    memo: e.memo,
    tx: e.tx,
    explorer: `${c.explorer}/tx/${e.tx}`,
  }));

  if (sender) rows = rows.filter((r) => r.payer.toLowerCase() === sender.toLowerCase());
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);

  const gross = rows.reduce((s, r) => s + r.gross_usdc, 0);
  const withheld = rows.reduce((s, r) => s + r.withheld_usdc, 0);
  const net = rows.reduce((s, r) => s + r.net_usdc, 0);

  console.log(`source   : ${source === 'explorer' ? 'explorer API' : 'recent-block RPC scan'}`);
  console.log(`receipts : ${rows.length}`);
  console.log(`gross    : ${gross.toFixed(6)} USDC`);
  console.log(`withheld : ${withheld.toFixed(6)} USDC`);
  console.log(`net paid : ${net.toFixed(6)} USDC`);

  const byPayee = summarise(rows);
  if (byPayee.size > 0) {
    console.log('\nby payee:');
    for (const [payee, t] of byPayee) {
      console.log(`  ${payee}  ${t.count} payout(s)  gross ${t.gross.toFixed(2)}  withheld ${t.withheld.toFixed(4)}`);
    }
  }

  const csvPath = flag(argv, 'csv');
  if (csvPath) {
    fs.writeFileSync(csvPath, stringify(COLUMNS, rows));
    console.log(`\nwrote ${csvPath}`);
  }

  const htmlPath = flag(argv, 'html');
  if (htmlPath) {
    fs.writeFileSync(htmlPath, require('./lib/receipt-html')(rows, { chain: c, gross, withheld, net, from, to }));
    console.log(`wrote ${htmlPath} (open and print to PDF)`);
  }
}

main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
