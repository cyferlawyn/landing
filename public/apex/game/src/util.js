// util.js — shared utility helpers

/**
 * Format a number for display with SI suffixes.
 * fmt(999)        → "999"
 * fmt(1000)       → "1k"
 * fmt(12345)      → "12.3k"
 * fmt(1000000)    → "1m"
 * fmt(2500000000) → "2.5b"
 * Precision: 1 decimal place, trailing ".0" stripped.
 */
export function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  let result;
  if      (abs >= 1e12) result = (n / 1e12).toFixed(1) + 't';
  else if (abs >= 1e9)  result = (n / 1e9 ).toFixed(1) + 'b';
  else if (abs >= 1e6)  result = (n / 1e6 ).toFixed(1) + 'm';
  else if (abs >= 1e3)  result = (n / 1e3 ).toFixed(1) + 'k';
  else                  result = String(Math.round(n));
  return result.replace(/(\.\d)0([kmbt])$/, '$1$2').replace(/\.0([kmbt])$/, '$1');
}

/**
 * Format a percentage bonus that can grow very large.
 * fmtPct(0.05)   → "+5%"
 * fmtPct(1.00)   → "+100%"
 * fmtPct(50.0)   → "+5000%"
 * fmtPct(500.0)  → "+50k%"
 */
export function fmtPct(fraction) {
  return '+' + fmt(Math.round(fraction * 100)) + '%';
}
