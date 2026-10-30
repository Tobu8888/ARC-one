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
const { chain, provider } = require('./lib/arc');

/** Blockscout keeps the creation bytecode even when the calldata does not hold it. */
async function explorerCreationCode(network, address) {
  try {
    const res = await fetch(`${chain(network).explorer}/api/v2/smart-contracts/${address}`);
    if (!res.ok) return null;
    const body = await res.json();
    const code = body.creation_bytecode;
    return code ? code.replace(/^0x/, '') : null;
  } catch {
    return null;
  }
}

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

  let input = tx.data.slice(2);
  const runtime = (await p.getCode(address)).slice(2);
  if (runtime.length === 0) throw new Error(`no code at ${address}`);

  let at = input.indexOf(runtime);
  if (at < 0) {
    // Some deploys hand the init code to a factory, so it never appears in the
    // outer calldata. The explorer keeps the creation bytecode either way.
    const fromExplorer = await explorerCreationCode(network, address);
    if (!fromExplorer) throw new Error('runtime code is not in the calldata and the explorer has no creation bytecode');
    console.log('calldata did not contain the runtime, using the explorer creation bytecode');
    input = fromExplorer;
    at = input.indexOf(runtime);
    if (at < 0) {
      // A contract with immutable variables has them patched into the runtime at
      // deploy time, so the stored code never matches the template byte for byte.
      // The explorer blob is already the full creation code; take it whole.
      console.log('runtime differs from the template, which is what immutables look like');
      const end = fromExplorer.length;
      const start2 = 0;
      const argsHex = fromExplorer.slice(end - argCount * 64);
      console.log(`constructor arguments (last ${argCount} words):`);
      for (let i = 0; i < argCount; i++) console.log('  0x' + argsHex.slice(i * 64, (i + 1) * 64));
      const file2 = out || 'creation.hex';
      fs.writeFileSync(file2, '0x' + fromExplorer.slice(start2));
      console.log(`\nwrote ${file2} (${(end - start2) / 2} bytes, whole creation blob)`);
      return;
    }
  }

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
