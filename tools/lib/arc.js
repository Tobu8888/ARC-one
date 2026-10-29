'use strict';

/**
 * Shared chain config and helpers for the ARCone tools.
 *
 * On Arc, USDC is both the native gas token (18 decimals) and an ERC-20 at a
 * predeploy address (6 decimals). Both views report the same money, so never
 * add them together.
 */

const { ethers } = require('ethers');
const fs = require('fs');

const USDC = '0x3600000000000000000000000000000000000000';
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

const CHAINS = {
  mainnet: {
    name: 'Arc',
    chainId: 5042,
    rpc: 'https://rpc.mainnet.arc.io',
    explorer: 'https://explorer.arc.io',
  },
  testnet: {
    name: 'Arc Testnet',
    chainId: 5042002,
    // The RPC hosts published in some chain lists (*.arc.network) no longer
    // resolve; this is the one that answers.
    rpc: 'https://rpc.testnet.arc.io',
    explorer: 'https://explorer.testnet.arc.io',
  },
};

const PAYOUTS_ABI = [
  'function sendPayout(address recipient, uint256 grossAmount, string memo)',
  'function getQuote(uint256 grossAmount) view returns (uint256 withheld, uint256 net)',
  'function owner() view returns (address)',
  'function treasury() view returns (address)',
  'function withholdingBps() view returns (uint16)',
  'function usdc() view returns (address)',
  'function totalPayouts() view returns (uint256)',
  'function setTreasury(address newTreasury)',
  'function setWithholdingBps(uint16 newBps)',
  'event PayoutSent(uint256 indexed payoutId, address indexed sender, address indexed recipient, uint256 grossAmount, uint256 withheldAmount, uint256 netAmount, uint16 withholdingBps, string memo, uint256 timestamp)',
];

const INVOICE_ABI = [
  'function createInvoice(address payer, uint256 amount, string memo, uint256 dueDate) returns (uint256 id)',
  'function payInvoice(uint256 id)',
  'function cancelInvoice(uint256 id)',
  'function getInvoice(uint256 id) view returns ((uint256 id, address payee, address payer, uint256 amount, string memo, uint256 dueDate, uint8 status, uint256 paidAt))',
  'function invoiceCount() view returns (uint256)',
  'function owner() view returns (address)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

function chain(nameOrAlias) {
  const c = CHAINS[nameOrAlias];
  if (!c) throw new Error(`unknown network "${nameOrAlias}" (use mainnet or testnet)`);
  return c;
}

function provider(networkName) {
  const c = chain(networkName);
  return new ethers.JsonRpcProvider(c.rpc, c.chainId);
}

/**
 * Loads a signer from a JSON key file: { "privateKey": "0x..." }.
 * The path comes from the caller or ARCONE_KEYFILE; nothing is ever committed.
 */
function signer(networkName, keyfile) {
  const path = keyfile || process.env.ARCONE_KEYFILE;
  if (!path) throw new Error('no key file given (pass one or set ARCONE_KEYFILE)');
  if (!fs.existsSync(path)) throw new Error(`key file not found: ${path}`);
  const { privateKey } = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!privateKey) throw new Error(`key file has no privateKey field: ${path}`);
  return new ethers.Wallet(privateKey, provider(networkName));
}

const usdc = (raw) => Number(raw) / 1e6;        // ERC-20 view, 6 decimals
const gasUsdc = (wei) => ethers.formatEther(wei); // native view, 18 decimals

module.exports = {
  USDC, MULTICALL3, CHAINS, PAYOUTS_ABI, INVOICE_ABI, ERC20_ABI,
  chain, provider, signer, usdc, gasUsdc,
};
