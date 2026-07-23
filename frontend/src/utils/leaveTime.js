// Helpers for displaying leave-request time as dd/mm/yyyy + school periods (tiết).
// Backend returns datetimes as "YYYY-MM-DD HH:mm" (DB-local), so we parse the
// string directly to avoid timezone shifts.

const PERIODS = [
  { no: 1, start: "07:30", end: "08:15" },
  { no: 2, start: "08:20", end: "09:05" },
  { no: 3, start: "09:10", end: "09:55" },
  { no: 4, start: "10:00", end: "10:45" },
  { no: 5, start: "13:30", end: "14:15" },
  { no: 6, start: "14:20", end: "15:05" },
  { no: 7, start: "15:10", end: "15:55" },
  { no: 8, start: "16:00", end: "16:45" },
];

function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function splitValue(value) {
  if (!value) return null;
  const [date, timeRaw = ""] = String(value).replace("T", " ").split(" ");
  return { date, time: timeRaw.slice(0, 5) };
}

// "YYYY-MM-DD ..." -> "dd/mm/yyyy"
export function formatDateVN(value) {
  const p = splitValue(value);
  if (!p || !p.date) return "—";
  const [y, m, d] = p.date.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

// Date range as dd/mm/yyyy (collapses to one date when same day).
export function formatLeaveDateRange(startValue, endValue) {
  const s = formatDateVN(startValue);
  const e = formatDateVN(endValue);
  if (e === "—" || e === s) return s;
  return `${s} → ${e}`;
}

// Returns periods covered by the leave window, e.g. "Cả ngày (8 tiết)",
// "Tiết 1–4 (4 tiết)", or "N ngày" for multi-day leaves.
export function formatLeavePeriods(startValue, endValue) {
  const s = splitValue(startValue);
  const e = splitValue(endValue);
  if (!s) return "";

  if (e && e.date && e.date !== s.date) {
    const d1 = new Date(`${s.date}T00:00:00`);
    const d2 = new Date(`${e.date}T00:00:00`);
    const days = Math.round((d2 - d1) / 86400000) + 1;
    return Number.isFinite(days) && days > 0 ? `${days} ngày` : "";
  }

  if (!s.time || !e || !e.time) return "";
  const startMin = toMin(s.time);
  const endMin = toMin(e.time);
  const covered = PERIODS.filter((p) => toMin(p.start) < endMin && toMin(p.end) > startMin);
  if (covered.length === 0) return "";
  if (covered.length === PERIODS.length) return `Cả ngày (${PERIODS.length} tiết)`;
  const first = covered[0].no;
  const last = covered[covered.length - 1].no;
  const range = first === last ? `Tiết ${first}` : `Tiết ${first}–${last}`;
  return `${range} (${covered.length} tiết)`;
}
