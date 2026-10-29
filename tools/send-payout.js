'use strict';

/**
 * Sends one payout through ArconePayouts: approve, then sendPayout.
 *
 *   node send-payout.js <network> <contract> <recipient> <amountUSDC> "<memo>" <keyfile> [--yes]
 *
 * Gas on Arc is paid in the same USDC being sent, so the script refuses to
 * spend the whole balance and keeps a small reserve for the two transactions.
 */

const { ethers } = require('ethers');
const { chain, signer, PAYOUTS_ABI, ERC20_ABI, USDC, usdc, gasUsdc } = require('./lib/arc');

const RESERVE = 10_000n; // 0.01 USDC kept back for gas

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--yes');
  const [network, contract, recipient, amount, memo, keyfile] = args.filter((a) => a !== '--yes');
  if (!network || !contract || !recipient || !amount || !memo || !keyfile) {
    console.error('usage: node send-payout.js <network> <contract> <recipient> <amountUSDC> "<memo>" <keyfile> [--yes]');
    process.exit(1);
  }

  const c = chain(network);
  const w = signer(network, keyfile);
  const gross = ethers.parseUnits(amount, 6);

  const token = new ethers.Contract(USDC, ERC20_ABI, w);
  const payouts = new ethers.Contract(contract, PAYOUTS_ABI, w);

  const balance = await token.balanceOf(w.address);
  const [withheld, net] = await payouts.getQuote(gross);

  console.log(`network   : ${c.name}`);
  console.log(`payer     : ${w.address}`);
  console.log(`balance   : ${usdc(balance)} USDC`);
  console.log(`gross     : ${usdc(gross)} USDC`);
  console.log(`withheld  : ${usdc(withheld)} USDC`);
  console.log(`net       : ${usdc(net)} USDC to ${recipient}`);

  if (balance < gross + RESERVE) {
    throw new Error(`balance too low: need ${usdc(gross + RESERVE)} USDC including a gas reserve`);
  }
  if (!confirm) {
    console.log('\ndry run only. re-run with --yes to send.');
    return;
  }

  const approve = await token.approve(contract, gross);
  await approve.wait();
  console.log('\napprove   :', approve.hash);

  const tx = await payouts.sendPayout(recipient, gross, memo);
  const r = await tx.wait();
  console.log('payout    :', tx.hash);
  console.log('status    :', r.status, '| block', r.blockNumber);
  console.log('gas paid  :', gasUsdc(r.gasUsed * r.gasPrice), 'USDC');
  console.log('explorer  :', `${c.explorer}/tx/${tx.hash}`);
}

main().catch((e) => { console.error('failed:', e.shortMessage || e.message); process.exit(1); });
