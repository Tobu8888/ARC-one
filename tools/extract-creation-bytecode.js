'use strict';

/**
 * Recovers the creation bytecode of a contract that was deployed through an
 * ERC-4337 EntryPoint (which is how Arc Studio deploys), so the same build can
 * be redeployed from an EOA you control.
 *
 * The deploy transaction is a handleOps call, so the init code sits inside the
 * userOp calldata. The runtime code is a substring of it: everything before the
 * runtime is the constructor prologue, everything after it is the ABI-encoded
 * constructor arguments.
 *
 *   node extract-creation-bytecode.js <network> <contract> <deployTxHash> [out.hex]
 */

const fs = require('fs');
const { provider } = require('./lib/arc');

async function main() {
  const argv = process.argv.slice(2);
  const argsFlag = argv.indexOf('--args');
  const argCount = argsFlag >= 0 ? Number(argv[argsFlag + 1]) : 4;
  const positional = argsFlag >= 0 ? argv.filter((_, i) => i !== argsFlag && i !== argsFlag + 1) : argv;
  const [network, address, txHash, out] = positional;
  if (!network || !address || !txHash) {
    console.error('usage: node extract-creation-bytecode.js <network> <contract> <deployTxHash> [out.hex] [--args n]');
    process.exit(1);
  }

  const p = provider(network);
  const tx = await p.getTransaction(txHash);
  if (!tx) throw new Error(`transaction not found on ${network}: ${txHash}`);

  const input = tx.data.slice(2);
  const runtime = (await p.getCode(address)).slice(2);
  if (runtime.length === 0) throw new Error(`no code at ${address}`);

  const at = input.indexOf(runtime);
  if (at < 0) throw new Error('runtime code is not contained in the deploy calldata');

  // The constructor prologue starts at the last standard solc preamble before
  // the runtime blob.
  const before = input.slice(0, at);
  const start = before.lastIndexOf('6080604052');
  if (start < 0) throw new Error('could not find the constructor prologue');

  const tail = input.slice(at + runtime.length);
  const words = [];
  for (let i = 0; i + 64 <= tail.length; i += 64) words.push(tail.slice(i, i + 64));

  console.log('runtime bytes      :', runtime.length / 2);
  console.log('prologue offset    :', start / 2);
  console.log('trailing words     :', words.length);
  console.log('constructor args (first 8 words):');
  words.slice(0, 8).forEach((w, i) => console.log(`  [${i}] 0x${w}`));

  // The calldata continues past the constructor arguments with the rest of the
  // userOp, so the blob has to be cut at the end of the arguments themselves.
  const end = at + runtime.length + argCount * 64;
  if (end > input.length) throw new Error(`calldata ends before ${argCount} constructor arguments`);

  const file = out || 'creation.hex';
  fs.writeFileSync(file, '0x' + input.slice(start, end));
  console.log(`\nwrote ${file} (${(end - start) / 2} bytes, ${argCount} constructor arguments kept)`);
  console.log('use encode-constructor-args.js to replace them with your own');
}

main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
