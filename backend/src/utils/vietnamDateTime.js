function parseVietnamDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value).trim();
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const date = new Date(hasExplicitTimezone ? normalized : `${normalized}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toMysqlDateTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  const localMatch = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (localMatch) return `${localMatch[1]} ${localMatch[2]}:${localMatch[3] || "00"}`;

  const date = parseVietnamDateTime(value);
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

module.exports = { parseVietnamDateTime, toMysqlDateTime };
