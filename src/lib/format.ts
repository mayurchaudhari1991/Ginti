/** Indian digit grouping (1,24,300), done by hand so it never depends on Intl data in the JS engine. */
function groupIndian(int: string) {
  if (int.length <= 3) return int;
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export function inr(value: number, opts: { decimals?: boolean; sign?: boolean } = {}) {
  const neg = value < 0;
  const abs = Math.abs(value);
  const [int, frac] = abs.toFixed(opts.decimals ? 2 : 0).split('.');
  const body = `₹${groupIndian(int)}${frac ? `.${frac}` : ''}`;
  if (neg) return `−${body}`;
  return opts.sign && value > 0 ? `+${body}` : body;
}

/** Short form for tight spaces: ₹42.9k, ₹1.2L, ₹3.4Cr. */
export function inrShort(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthName = (m: number) => MONTHS[m];

export function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === now.toDateString()) return hhmm;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'YESTERDAY';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].toUpperCase()}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
