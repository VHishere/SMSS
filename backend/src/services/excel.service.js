const ExcelJS = require("exceljs");

const NAVY = "FF0F2747";
const ORANGE = "FFF27123";
const CREAM = "FFFFF7F2";

/**
 * Build an .xlsx workbook buffer from a normalized report dataset.
 * dataset = { title, generatedAt, filtersLabel, sections: [{ heading, columns, rows, summary }] }
 */
async function buildWorkbook(dataset) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "KidCare";
  wb.created = new Date();

  const ws = wb.addWorksheet("Báo cáo", {
    views: [{ showGridLines: false }],
  });

  let rowIdx = 1;

  // Title
  ws.mergeCells(rowIdx, 1, rowIdx, 8);
  const titleCell = ws.getCell(rowIdx, 1);
  titleCell.value = dataset.title;
  titleCell.font = { size: 16, bold: true, color: { argb: NAVY } };
  rowIdx += 1;

  // Meta line
  ws.mergeCells(rowIdx, 1, rowIdx, 8);
  const metaCell = ws.getCell(rowIdx, 1);
  metaCell.value = `${dataset.filtersLabel || ""}  ·  Xuất lúc: ${dataset.generatedAt}`;
  metaCell.font = { size: 10, italic: true, color: { argb: "FF64748B" } };
  rowIdx += 2;

  for (const section of dataset.sections) {
    // Section heading
    ws.mergeCells(rowIdx, 1, rowIdx, Math.max(section.columns.length, 1));
    const head = ws.getCell(rowIdx, 1);
    head.value = section.heading;
    head.font = { size: 12, bold: true, color: { argb: ORANGE } };
    rowIdx += 1;

    // Column header row
    const headerRow = ws.getRow(rowIdx);
    section.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFFFE7D6" } } };
    });
    headerRow.commit?.();
    rowIdx += 1;

    // Data rows
    for (const row of section.rows) {
      const r = ws.getRow(rowIdx);
      section.columns.forEach((col, i) => {
        const cell = r.getCell(i + 1);
        const v = row[col.key];
        cell.value = v === null || v === undefined ? "" : v;
        cell.alignment = { vertical: "middle" };
        if (rowIdx % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
      });
      rowIdx += 1;
    }

    // Summary block
    if (section.summary && section.summary.length) {
      rowIdx += 1;
      for (const s of section.summary) {
        const labelCell = ws.getCell(rowIdx, 1);
        labelCell.value = s.label;
        labelCell.font = { bold: true, color: { argb: NAVY } };
        ws.getCell(rowIdx, 2).value = s.value;
        rowIdx += 1;
      }
    }

    rowIdx += 1; // gap between sections
  }

  // Auto width
  ws.columns.forEach((col) => {
    let max = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 48);
  });

  return wb.xlsx.writeBuffer();
}

module.exports = { buildWorkbook };
