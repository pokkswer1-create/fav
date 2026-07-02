function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function normalizeMonthKey(input: string) {
  const raw = (input ?? "").trim();
  // Accept YYYY-MM or anything that *starts* with YYYY-MM (e.g. YYYY-MM-DD, accidental suffix chars)
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (!m) return raw;
  return `${m[1]}-${m[2]}`;
}

export function monthStartDate(monthKey: string) {
  const mk = normalizeMonthKey(monthKey);
  return `${mk}-01`;
}

export function monthEndDate(monthKey: string) {
  const mk = normalizeMonthKey(monthKey);
  const m = mk.match(/^(\d{4})-(\d{2})$/);
  if (!m) return `${mk}-31`;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  // day=0 of next month => last day of current month
  const end = new Date(Date.UTC(y, mo, 0));
  return `${end.getUTCFullYear()}-${pad2(end.getUTCMonth() + 1)}-${pad2(end.getUTCDate())}`;
}

export function monthRange(monthKey: string) {
  const mk = normalizeMonthKey(monthKey);
  const from = monthStartDate(mk);
  const to = monthEndDate(mk);
  return { from, to };
}

export function monthRangeTs(monthKey: string) {
  const mk = normalizeMonthKey(monthKey);
  const { from, to } = monthRange(mk);
  return { fromTs: `${from}T00:00:00`, toTs: `${to}T23:59:59` };
}

