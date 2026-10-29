'use strict';

/**
 * Minimal CSV handling: enough for payout batches and receipt exports,
 * without pulling in a dependency.
 */

/** Parses CSV text into rows of objects keyed by the header line. */
function parse(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return [];
  const header = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line, i) => {
    const cells = splitLine(line);
    if (cells.length !== header.length) {
      throw new Error(`row ${i + 2}: expected ${header.length} columns, found ${cells.length}`);
    }
    return Object.fromEntries(header.map((h, j) => [h, cells[j].trim()]));
  });
}

/** Splits one line, honouring double quotes around values that contain commas. */
function splitLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Serialises rows (array of objects) using the given column order. */
function stringify(columns, rows) {
  const esc = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

module.exports = { parse, stringify, splitLine };
