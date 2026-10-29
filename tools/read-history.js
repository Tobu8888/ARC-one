'use strict';

/**
 * Reads payout history the way the app does: the explorer API returns every
 * log of the contract in one call, which avoids the RPC's 10,000-block
 * eth_getLogs cap and its rate limiting.
 *
 *   node read-history.js <network> <contract> [senderAddress]
 */

const { ethers } = require('ethers');
const { chain, provider, PAYOUTS_ABI } = require('./lib/arc');

const PAYOUT_SENT = new ethers.Interface(PAYOUTS_ABI).getEvent('PayoutSent');
const TOPIC = PAYOUT_SENT.topicHash;

async function fetchLogs(explorer, address) {
  const out = [];
  let url = `${explorer}/api/v2/addresses/${address}/logs`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`explorer API ${res.status}`);
    const page = await res.json();
    out.push(...page.items);
    if (!page.next_page_params) break;
    const qs = new URLSearchParams(
      Object.entries(page.next_page_params).map(([k, v]) => [k, String(v)])
    );
    url = `${explorer}/api/v2/addresses/${address}/logs?${qs}`;
  }
  return out;
}

/** Fallback for when the explorer API is unreachable: scan recent blocks only. */
async function recentLogs(network, address, span) {
  const p = provider(network);
  const head = await p.getBlockNumber();
  const from = head > span ? head - span : 0;
  const logs = await p.getLogs({ address, topics: [TOPIC], fromBlock: from, toBlock: head });
  console.log(`explorer API unavailable, scanned the last ${head - from} blocks instead`);
  return logs.map((l) => ({
    topics: l.topics, data: l.data, block_number: l.blockNumber, transaction_hash: l.transactionHash,
  }));
}

async function main() {
  const [network, address, sender] = process.argv.slice(2);
  if (!network || !address) {
    console.error('usage: node read-history.js <network> <contract> [sender]');
    process.exit(1);
  }
  const c = chain(network);
  let raw;
  try {
    raw = await fetchLogs(c.explorer, address);
  } catch (e) {
    raw = await recentLogs(network, address, 9_000); // stay under the 10,000-block cap
  }
  const logs = raw.filter((l) => l.topics[0] === TOPIC);

  const iface = new ethers.Interface(PAYOUTS_ABI);
  let rows = logs.map((l) => {
    const { args } = iface.parseLog({ topics: l.topics, data: l.data });
    return {
      block: l.block_number,
      tx: l.transaction_hash,
      sender: args.sender,
      recipient: args.recipient,
      gross: Number(args.grossAmount) / 1e6,
      withheld: Number(args.withheldAmount) / 1e6,
      net: Number(args.netAmount) / 1e6,
      memo: args.memo,
    };
  });

  if (sender) {
    const want = sender.toLowerCase();
    rows = rows.filter((r) => r.sender.toLowerCase() === want);
  }

  console.log(`${rows.length} payout(s) on ${c.name}`);
  for (const r of rows.sort((a, b) => b.block - a.block)) {
    console.log(
      `  block ${r.block}  ${r.gross.toFixed(2)} -> ${r.net.toFixed(2)} (wht ${r.withheld.toFixed(3)})  ` +
      `${r.recipient.slice(0, 10)}  "${r.memo}"`
    );
    console.log(`    ${c.explorer}/tx/${r.tx}`);
  }
}

main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
