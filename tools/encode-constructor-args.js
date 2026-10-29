'use strict';

/**
 * Rewrites the constructor arguments at the end of a creation bytecode blob.
 *
 * ArconePayouts takes (address usdc, address treasury, uint16 bps, address owner),
 * so the last four 32-byte words of the creation code are replaced.
 *
 *   node encode-constructor-args.js <creation.hex> <treasury> <bps> <owner> [out.hex]
 */

const fs = require('fs');
const { ethers } = require('ethers');
const { USDC } = require('./lib/arc');

function word(value) {
  return ethers.zeroPadValue(value, 32).slice(2);
}

function main() {
  const [file, treasury, bps, owner, out] = process.argv.slice(2);
  if (!file || !treasury || !bps || !owner) {
    console.error('usage: node encode-constructor-args.js <creation.hex> <treasury> <bps> <owner> [out.hex]');
    process.exit(1);
  }

  const code = fs.readFileSync(file, 'utf8').trim().replace(/^0x/, '');
  const body = code.slice(0, code.length - 4 * 64);
  const old = code.slice(code.length - 4 * 64);

  const args =
    word(USDC) +
    word(ethers.getAddress(treasury)) +
    word(ethers.toBeHex(Number(bps))) +
    word(ethers.getAddress(owner));

  console.log('previous arguments:');
  for (let i = 0; i < 4; i++) console.log('  0x' + old.slice(i * 64, (i + 1) * 64));
  console.log('new arguments:');
  for (let i = 0; i < 4; i++) console.log('  0x' + args.slice(i * 64, (i + 1) * 64));

  const target = out || 'creation.args.hex';
  fs.writeFileSync(target, '0x' + body + args);
  console.log(`\nwrote ${target} (${(body.length + args.length) / 2} bytes)`);
}

main();
