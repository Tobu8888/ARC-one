'use strict';

/**
 * Replaces the constructor arguments at the end of a creation bytecode blob.
 *
 *   node encode-constructor-args.js <creation.hex> <out.hex> <value...>
 *
 * Values are given in constructor order and may be addresses or integers; each
 * becomes one 32-byte word. The number of values decides how many trailing
 * words are replaced, so the same script covers both contracts:
 *
 *   ArconePayouts(usdc, treasury, bps, owner)   4 values
 *   ArconeInvoice(usdc, owner)                  2 values
 */

const fs = require('fs');
const { ethers } = require('ethers');

function word(value) {
  if (ethers.isAddress(value)) return ethers.zeroPadValue(ethers.getAddress(value), 32).slice(2);
  if (/^\d+$/.test(value)) return ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 32).slice(2);
  throw new Error(`value is neither an address nor an integer: ${value}`);
}

function main() {
  const [file, out, ...values] = process.argv.slice(2);
  if (!file || !out || values.length === 0) {
    console.error('usage: node encode-constructor-args.js <creation.hex> <out.hex> <value...>');
    process.exit(1);
  }

  const code = fs.readFileSync(file, 'utf8').trim().replace(/^0x/, '');
  const span = values.length * 64;
  if (code.length <= span) throw new Error('creation blob is shorter than the arguments to replace');

  const body = code.slice(0, code.length - span);
  const old = code.slice(code.length - span);
  const args = values.map(word).join('');

  console.log('previous arguments:');
  for (let i = 0; i < values.length; i++) console.log('  0x' + old.slice(i * 64, (i + 1) * 64));
  console.log('new arguments:');
  for (let i = 0; i < values.length; i++) console.log('  0x' + args.slice(i * 64, (i + 1) * 64));

  fs.writeFileSync(out, '0x' + body + args);
  console.log(`\nwrote ${out} (${(body.length + args.length) / 2} bytes)`);
}

main();
