// Render a normalized report dataset to a print-friendly document and trigger
// the browser print dialog (used for "Export PDF"). Guarantees the printed
// output matches the on-screen data and renders Vietnamese correctly.

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(dataset) {
  const sections = dataset.sections
    .map((section) => {
      const headCells = section.columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
      const bodyRows = section.rows.length
        ? section.rows
            .map((row) => `<tr>${section.columns.map((c) => `<td>${escapeHtml(row[c.key])}</td>`).join("")}</tr>`)
            .join("")
        : `<tr><td colspan="${section.columns.length}" class="empty">Không có dữ liệu</td></tr>`;

      const summary = section.summary && section.summary.length
        ? `<div class="summary">${section.summary
            .map((s) => `<div><span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong></div>`)
            .join("")}</div>`
        : "";

      return `
        <h2>${escapeHtml(section.heading)}</h2>
        <table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>
        ${summary}
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8" /><title>${escapeHtml(dataset.title)}</title>
<style>
  * { font-family: "Segoe UI", system-ui, sans-serif; box-sizing: border-box; }
  body { margin: 24px; color: #0F2747; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #0F2747; }
  .meta { font-size: 12px; color: #64748B; margin-bottom: 18px; font-style: italic; }
  h2 { font-size: 14px; color: #F27123; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  th { background: #0F2747; color: #fff; text-align: left; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #FFE7D6; }
  tr:nth-child(even) td { background: #FFF7F2; }
  td.empty { text-align: center; color: #94A3B8; font-style: italic; }
  .summary { display: flex; flex-wrap: wrap; gap: 16px; margin: 8px 0 4px; font-size: 12px; }
  .summary div { background: #FFF7F2; border: 1px solid #FFE7D6; border-radius: 8px; padding: 6px 12px; }
  .summary span { color: #64748B; margin-right: 6px; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  <h1>${escapeHtml(dataset.title)}</h1>
  <div class="meta">${escapeHtml(dataset.filtersLabel || "")} · Xuất lúc: ${escapeHtml(dataset.generatedAt)}</div>
  ${sections}
</body></html>`;
}

export function printReport(dataset) {
  const html = buildHtml(dataset);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.focus();
  // Give the iframe a tick to lay out before printing.
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 250);
}
