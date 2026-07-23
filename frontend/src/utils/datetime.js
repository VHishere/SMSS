// Format backend datetimes ("YYYY-MM-DD HH:mm" or ISO) for display.

function splitValue(value) {
  if (!value) return null;
  const [date, timeRaw = ""] = String(value).replace("T", " ").split(" ");
  return { date, time: timeRaw.slice(0, 5) };
}

// "2026-04-09 07:30" -> "09/04/2026"
export function formatDateVN(value) {
  const p = splitValue(value);
  if (!p || !p.date) return "—";
  const [y, m, d] = p.date.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

// "2026-04-09 07:30" -> "09/04/2026 07:30"
export function formatDateTimeVN(value) {
  const p = splitValue(value);
  if (!p || !p.date) return "—";
  const [y, m, d] = p.date.split("-");
  if (!y || !m || !d) return "—";
  return p.time ? `${d}/${m}/${y} ${p.time}` : `${d}/${m}/${y}`;
}
