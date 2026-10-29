'use strict';

/**
 * Deploys a creation bytecode blob from an EOA you control.
 *
 *   node deploy-contract.js <network> <creation.hex> <keyfile> [--yes]
 *
 * Without --yes it estimates gas, prints the cost and stops, so a mainnet
 * deploy is never one keystroke away from happening by accident.
 */

const fs = require('fs');
const { ethers } = require('ethers');
const { chain, signer, gasUsdc } = require('./lib/arc');

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--yes');
  const [network, file, keyfile] = args.filter((a) => a !== '--yes');
  if (!network || !file || !keyfile) {
    console.error('usage: node deploy-contract.js <network> <creation.hex> <keyfile> [--yes]');
    process.exit(1);
  }

  const c = chain(network);
  const w = signer(network, keyfile);
  const code = fs.readFileSync(file, 'utf8').trim();

  const balance = await w.provider.getBalance(w.address);
  const gas = await w.provider.estimateGas({ from: w.address, data: code });
  const price = (await w.provider.getFeeData()).gasPrice;

  console.log(`network   : ${c.name} (${c.chainId})`);
  console.log(`deployer  : ${w.address}`);
  console.log(`balance   : ${gasUsdc(balance)} USDC`);
  console.log(`bytecode  : ${(code.length - 2) / 2} bytes`);
  console.log(`gas       : ${gas} units, about ${gasUsdc(gas * price)} USDC`);

  if (!confirm) {
    console.log('\ndry run only. re-run with --yes to send the transaction.');
    return;
  }

  const tx = await w.sendTransaction({ data: code });
  console.log('\ndeploy tx :', tx.hash);
  const r = await tx.wait();
  console.log('status    :', r.status, '| block', r.blockNumber);
  console.log('address   :', r.contractAddress);
  console.log('paid      :', gasUsdc(r.gasUsed * r.gasPrice), 'USDC');
  console.log('explorer  :', `${c.explorer}/address/${r.contractAddress}`);
}

main().catch((e) => { console.error('failed:', e.shortMessage || e.message); process.exit(1); });
