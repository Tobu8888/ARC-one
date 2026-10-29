'use strict';

/**
 * Pays a list of contractors from one CSV file.
 *
 *   node batch-payout.js <network> <contract> <payouts.csv> <keyfile> [--yes] [--from n]
 *
 * The CSV needs a header line and the columns recipient, amount, memo.
 *
 * ArconePayouts has no batch entry point, so this sends one transaction per
 * payout. What it does save is the approvals: a single approve covers the whole
 * run. Each payout is reported as it confirms, and a failure stops the run and
 * prints the index to resume from, so money is never sent twice.
 */

const fs = require('fs');
const { ethers } = require('ethers');
const { chain, signer, PAYOUTS_ABI, ERC20_ABI, USDC, usdc, gasUsdc } = require('./lib/arc');
const { parse } = require('./lib/csv');

const RESERVE = 20_000n; // 0.02 USDC kept back for gas across the run

function readRows(file) {
  const rows = parse(fs.readFileSync(file, 'utf8'));
  return rows.map((r, i) => {
    const line = i + 2;
    if (!r.recipient || !r.amount) throw new Error(`row ${line}: recipient and amount are required`);
    if (!ethers.isAddress(r.recipient)) throw new Error(`row ${line}: ${r.recipient} is not an address`);
    const gross = ethers.parseUnits(r.amount, 6);
    if (gross <= 0n) throw new Error(`row ${line}: amount must be greater than zero`);
    if (!r.memo || !r.memo.trim()) throw new Error(`row ${line}: memo is required by the contract`);
    return { line, recipient: ethers.getAddress(r.recipient), gross, memo: r.memo.trim() };
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const confirm = argv.includes('--yes');
  const fromFlag = argv.indexOf('--from');
  const startAt = fromFlag >= 0 ? Number(argv[fromFlag + 1]) : 0;
  const positional = argv.filter((a, i) => {
    if (a === '--yes') return false;
    if (fromFlag >= 0 && (i === fromFlag || i === fromFlag + 1)) return false;
    return true;
  });
  const [network, contract, file, keyfile] = positional;

  if (!network || !contract || !file || !keyfile) {
    console.error('usage: node batch-payout.js <network> <contract> <payouts.csv> <keyfile> [--yes] [--from n]');
    process.exit(1);
  }

  const c = chain(network);
  const w = signer(network, keyfile);
  const rows = readRows(file).slice(startAt);
  const total = rows.reduce((sum, r) => sum + r.gross, 0n);

  const token = new ethers.Contract(USDC, ERC20_ABI, w);
  const payouts = new ethers.Contract(contract, PAYOUTS_ABI, w);
  const balance = await token.balanceOf(w.address);
  const [withheldTotal, netTotal] = await payouts.getQuote(total);

  console.log(`network    : ${c.name}`);
  console.log(`payer      : ${w.address}`);
  console.log(`balance    : ${usdc(balance)} USDC`);
  console.log(`payouts    : ${rows.length}`);
  console.log(`gross total: ${usdc(total)} USDC`);
  console.log(`withheld   : ${usdc(withheldTotal)} USDC`);
  console.log(`net total  : ${usdc(netTotal)} USDC\n`);
  for (const r of rows) {
    console.log(`  ${r.recipient}  ${usdc(r.gross).toFixed(2)}  "${r.memo}"`);
  }

  if (balance < total + RESERVE) {
    throw new Error(`balance too low: need ${usdc(total + RESERVE)} USDC including a gas reserve`);
  }
  if (!confirm) {
    console.log('\ndry run only. re-run with --yes to send.');
    return;
  }

  console.log('\napproving the whole batch once...');
  const approve = await token.approve(contract, total);
  await approve.wait();
  console.log('approve    :', approve.hash);

  let spentGas = 0n;
  for (const [i, r] of rows.entries()) {
    try {
      const tx = await payouts.sendPayout(r.recipient, r.gross, r.memo);
      const receipt = await tx.wait();
      spentGas += receipt.gasUsed * receipt.gasPrice;
      console.log(`  [${i + 1}/${rows.length}] ${usdc(r.gross).toFixed(2)} -> ${r.recipient}  ${tx.hash}`);
    } catch (e) {
      console.error(`\nrow ${r.line} failed: ${e.shortMessage || e.message}`);
      console.error(`resume with: --from ${startAt + i}`);
      process.exit(2);
    }
  }

  console.log(`\ndone. gas for the run: ${gasUsdc(spentGas)} USDC`);
}

main().catch((e) => { console.error('failed:', e.shortMessage || e.message); process.exit(1); });
