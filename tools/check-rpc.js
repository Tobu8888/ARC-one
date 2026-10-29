'use strict';

/**
 * Probes an Arc RPC endpoint for the limits that matter to a frontend:
 * whether it answers at all, the largest eth_getLogs range it accepts, and
 * how many rapid requests it takes before rate limiting kicks in.
 *
 *   node check-rpc.js <network> [contractAddress]
 */

const { chain, provider } = require('./lib/arc');

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return res.json();
}

async function main() {
  const [network, address] = process.argv.slice(2);
  if (!network) {
    console.error('usage: node check-rpc.js <network> [contractAddress]');
    process.exit(1);
  }
  const c = chain(network);
  const head = await provider(network).getBlockNumber();
  console.log(`${c.name} (${c.chainId}) via ${c.rpc}`);
  console.log(`head block     : ${head}`);

  const target = address || '0x0000000000000000000000000000000000000000';
  console.log('\neth_getLogs range limit:');
  for (const span of [100_000, 50_000, 20_000, 10_000, 5_000]) {
    const from = head - span + 1;
    const r = await rpc(c.rpc, 'eth_getLogs', [{
      address: target,
      fromBlock: '0x' + from.toString(16),
      toBlock: '0x' + head.toString(16),
    }]);
    console.log(`  ${String(span).padStart(7)} blocks -> ${r.error ? r.error.message : 'ok'}`);
    await new Promise((r2) => setTimeout(r2, 1200));
  }

  console.log('\nrapid request behaviour (20 parallel eth_blockNumber):');
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => rpc(c.rpc, 'eth_blockNumber', []))
  );
  const failed = results.filter((r) => r.status === 'rejected' || r.value.error).length;
  console.log(`  ${20 - failed} ok, ${failed} rejected`);
  if (failed > 0) console.log('  reading history by scanning logs from a browser will not work here');
}

main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
