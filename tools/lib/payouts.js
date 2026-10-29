'use strict';

/**
 * Loading PayoutSent events, with the same two paths the app uses: the explorer
 * API when it is reachable, otherwise a short RPC scan.
 */

const { ethers } = require('ethers');
const { chain, provider, PAYOUTS_ABI } = require('./arc');

const iface = new ethers.Interface(PAYOUTS_ABI);
const TOPIC = iface.getEvent('PayoutSent').topicHash;

async function fromExplorer(explorer, address) {
  const items = [];
  let url = `${explorer}/api/v2/addresses/${address}/logs`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`explorer API ${res.status}`);
    const page = await res.json();
    items.push(...page.items);
    if (!page.next_page_params) break;
    const qs = new URLSearchParams(
      Object.entries(page.next_page_params).map(([k, v]) => [k, String(v)])
    );
    url = `${explorer}/api/v2/addresses/${address}/logs?${qs}`;
  }
  return items.map((l) => ({
    topics: l.topics, data: l.data,
    blockNumber: l.block_number, transactionHash: l.transaction_hash,
    timestamp: l.block_timestamp ? Math.floor(Date.parse(l.block_timestamp) / 1000) : null,
  }));
}

async function fromRpc(network, address, span) {
  const p = provider(network);
  const head = await p.getBlockNumber();
  const from = head > span ? head - span : 0;
  const logs = await p.getLogs({ address, topics: [TOPIC], fromBlock: from, toBlock: head });
  return logs.map((l) => ({
    topics: l.topics, data: l.data,
    blockNumber: l.blockNumber, transactionHash: l.transactionHash, timestamp: null,
  }));
}

/** Returns decoded payouts, newest first. Falls back to a recent-block scan. */
async function load(network, address, { span = 9_000 } = {}) {
  const c = chain(network);
  let raw;
  let source = 'explorer';
  try {
    raw = await fromExplorer(c.explorer, address);
  } catch {
    source = 'rpc';
    raw = await fromRpc(network, address, span);
  }

  const rows = raw
    .filter((l) => l.topics[0] === TOPIC)
    .map((l) => {
      const { args } = iface.parseLog({ topics: l.topics, data: l.data });
      const timestamp = l.timestamp ?? Number(args.timestamp);
      return {
        payoutId: Number(args.payoutId),
        sender: args.sender,
        recipient: args.recipient,
        gross: Number(args.grossAmount) / 1e6,
        withheld: Number(args.withheldAmount) / 1e6,
        net: Number(args.netAmount) / 1e6,
        bps: Number(args.withholdingBps),
        memo: args.memo,
        block: Number(l.blockNumber),
        tx: l.transactionHash,
        timestamp,
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        receipt: `WHT-${l.transactionHash.slice(2, 10).toUpperCase()}`,
      };
    })
    .sort((a, b) => b.block - a.block);

  return { source, rows };
}

module.exports = { load, TOPIC };
