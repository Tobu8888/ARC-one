'use strict';

/**
 * Prints payout history for a contract, newest first.
 *
 *   node read-history.js <network> <contract> [senderAddress]
 *
 * Loading goes through lib/payouts, which prefers the explorer API and falls
 * back to a short RPC scan when the explorer is unreachable.
 */

const { chain } = require('./lib/arc');
const { load } = require('./lib/payouts');

async function main() {
  const [network, address, sender] = process.argv.slice(2);
  if (!network || !address) {
    console.error('usage: node read-history.js <network> <contract> [sender]');
    process.exit(1);
  }

  const c = chain(network);
  const { source, rows } = await load(network, address);
  if (source === 'rpc') {
    console.log('explorer API unavailable, scanned recent blocks only');
  }

  const filtered = sender
    ? rows.filter((r) => r.sender.toLowerCase() === sender.toLowerCase())
    : rows;

  console.log(`${filtered.length} payout(s) on ${c.name}`);
  for (const r of filtered) {
    console.log(
      `  block ${r.block}  ${r.gross.toFixed(2)} -> ${r.net.toFixed(2)} ` +
      `(wht ${r.withheld.toFixed(3)})  ${r.recipient.slice(0, 10)}  "${r.memo}"`
    );
    console.log(`    ${c.explorer}/tx/${r.tx}`);
  }
}

main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
