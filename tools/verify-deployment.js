'use strict';

/**
 * Checks a deployed ArconePayouts against the build it is supposed to be.
 *
 *   node verify-deployment.js <network> <address> [referenceNetwork referenceAddress]
 *
 * Reads owner, treasury, rate and token from the chain, and optionally compares
 * the runtime bytecode with a reference deployment. Byte-identical runtime plus
 * an owner you hold the key to is the pair of facts worth proving.
 */

const { ethers } = require('ethers');
const { chain, provider, PAYOUTS_ABI } = require('./lib/arc');

async function main() {
  const [network, address, refNetwork, refAddress] = process.argv.slice(2);
  if (!network || !address) {
    console.error('usage: node verify-deployment.js <network> <address> [refNetwork refAddress]');
    process.exit(1);
  }

  const c = chain(network);
  const p = provider(network);
  const code = await p.getCode(address);
  if (code === '0x') throw new Error(`no contract at ${address} on ${c.name}`);

  const payouts = new ethers.Contract(address, PAYOUTS_ABI, p);
  const [owner, treasury, bps, token, total] = await Promise.all([
    payouts.owner(), payouts.treasury(), payouts.withholdingBps(),
    payouts.usdc(), payouts.totalPayouts(),
  ]);

  console.log(`network        : ${c.name} (${c.chainId})`);
  console.log(`address        : ${address}`);
  console.log(`runtime bytes  : ${(code.length - 2) / 2}`);
  console.log(`owner          : ${owner}`);
  console.log(`treasury       : ${treasury}`);
  console.log(`withholding    : ${bps} bps (${Number(bps) / 100}%)`);
  console.log(`usdc           : ${token}`);
  console.log(`payouts so far : ${total}`);

  if (refNetwork && refAddress) {
    const refCode = await provider(refNetwork).getCode(refAddress);
    const same = refCode === code;
    console.log(`\nreference      : ${refAddress} on ${chain(refNetwork).name}`);
    console.log(`runtime match  : ${same ? 'identical' : 'DIFFERENT'}`);
    if (!same) process.exitCode = 2;
  }
}

main().catch((e) => { console.error('failed:', e.shortMessage || e.message); process.exit(1); });
