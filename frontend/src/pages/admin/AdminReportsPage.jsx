import { useEffect, useMemo, useState } from "react";

import { adminApi } from "../../api/client";
import StaffPageHeader from "../../components/staff/StaffPageHeader";
import { printReport } from "../../utils/printReport";

function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

const REPORT_LABEL = {
  ATTENDANCE: "Báo cáo chuyên cần",
  ACADEMIC: "Báo cáo học tập",
  BEHAVIOUR: "Báo cáo hạnh kiểm",
  PROGRESS: "Báo cáo tiến bộ học sinh",
  CLASS_SUMMARY: "Báo cáo tổng hợp lớp",
  EFFICIENCY: "Báo cáo hiệu quả vận hành",
};
const NEEDS_SEMESTER = ["ACADEMIC", "BEHAVIOUR", "PROGRESS", "CLASS_SUMMARY"];
const NEEDS_STUDENT = ["PROGRESS"];
const NEEDS_DATERANGE = ["ATTENDANCE"];
// UC-110: school-wide report, no class picker — grouped by grade or by term instead.
const NEEDS_NO_CLASS = ["EFFICIENCY"];
const GROUP_BY_LABEL = { GRADE: "Khối lớp", SEMESTER: "Học kỳ" };

const selectCls = "rounded-xl border border-[#DFC0B2] bg-white px-3 py-2 text-sm text-[#1A1C1C] shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";

function isoToday() { return new Date().toISOString().slice(0, 10); }
function isoDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

// Read-only admin equivalent of teacher's Report Builder — same 5 report
// types, but classId/studentId can be ANY class/student school-wide. Admin
// can view + export (Excel/PDF) but cannot save report templates.
function AdminReportsPage() {
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [reportType, setReportType] = useState("ATTENDANCE");

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [groupBy, setGroupBy] = useState("GRADE");
  const [studentId, setStudentId] = useState("");
  const [startDate, setStartDate] = useState(isoDaysAgo(7));
  const [endDate, setEndDate] = useState(isoToday());
  const [students, setStudents] = useState([]);

  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    adminApi.getReportsMeta()
      .then((res) => setMeta(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setMetaLoading(false));
  }, []);

  const classes = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];
  const classId = selectedClassId || String(classes[0]?.classId || "");
  const semesterId = selectedSemesterId || String(semesters[0]?.semesterId || "");

  useEffect(() => {
    if (!NEEDS_STUDENT.includes(reportType) || !classId) return;
    let m = true;
    adminApi.getStudentsClassOverview(classId, semesterId)
      .then((res) => {
        if (!m) return;
        setStudents(res.data.students);
        if (!studentId && res.data.students[0]) setStudentId(String(res.data.students[0].studentId));
      })
      .catch(() => {});
    return () => { m = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, classId, semesterId]);

  function buildFilters() {
    if (reportType === "EFFICIENCY") {
      const f = { groupBy };
      if (groupBy === "GRADE") f.semesterId = Number(semesterId);
      return f;
    }
    const className = classes.find((c) => String(c.classId) === String(classId))?.className;
    const f = { className };
    if (!NEEDS_STUDENT.includes(reportType)) f.classId = Number(classId);
    if (NEEDS_SEMESTER.includes(reportType)) f.semesterId = Number(semesterId);
    if (NEEDS_STUDENT.includes(reportType)) { f.studentId = Number(studentId); f.classId = Number(classId); }
    if (NEEDS_DATERANGE.includes(reportType)) { f.startDate = startDate; f.endDate = endDate; }
    return f;
  }

  async function handleGenerate() {
    setLoading(true); setError(""); setDataset(null);
    try {
      const res = await adminApi.generateReport(reportType, buildFilters());
      setDataset(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExcel() {
    setExporting(true);
    try { await adminApi.exportReportExcel(reportType, buildFilters()); }
    catch (err) { setError(err.message); }
    finally { setExporting(false); }
  }

  async function handlePdf() {
    if (!dataset) return;
    printReport(dataset);
    try { await adminApi.logReportExport(reportType, buildFilters(), "PDF"); } catch { /* logging non-critical */ }
  }

  function applyPreset(days) { setStartDate(isoDaysAgo(days)); setEndDate(isoToday()); }
  function applySemesterRange() {
    const sem = semesters.find((s) => String(s.semesterId) === String(semesterId)) ?? semesters[0];
    if (sem) { setStartDate(sem.startDate); setEndDate(sem.endDate); }
  }

  function loadHistory() {
    setShowHistory((v) => !v);
    if (!history) {
      adminApi.getReportHistory({ limit: 20 }).then((res) => setHistory(res.data.items)).catch(() => setHistory([]));
    }
  }

  const reportTypeOptions = useMemo(() => meta?.reportTypes ?? Object.keys(REPORT_LABEL).map((key) => ({ key, label: REPORT_LABEL[key] })), [meta]);

  return (
    <>
      <StaffPageHeader
        title="Báo cáo"
        action={
          <button type="button" onClick={loadHistory} className="inline-flex items-center gap-2 rounded-full border border-[#DFC0B2] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F2747] no-underline hover:border-[#F27123] hover:text-[#F27123]">
            <Ms name="history" className="text-[16px]!" /> Lịch sử xuất báo cáo
          </button>
        }
      />

      {metaLoading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : (
        <>
          {showHistory && (
            <div className="mb-5 overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: "1px solid #DFC0B2" }}>
              <div className="border-b px-5 py-4" style={{ borderColor: "#DFC0B2", backgroundColor: "#F3F3F3" }}>
                <h3 className="text-base font-bold text-[#1A1C1C]">Lịch sử xuất báo cáo của bạn</h3>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {history == null ? (
                  <p className="p-5 text-sm text-slate-400">Đang tải...</p>
                ) : history.length === 0 ? (
                  <p className="p-5 text-sm text-slate-400">Chưa có báo cáo nào được xuất.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <tbody className="divide-y" style={{ borderColor: "#DFC0B2" }}>
                      {history.map((h) => (
                        <tr key={h.reportId}>
                          <td className="px-5 py-3 font-medium text-[#1A1C1C]">{h.title}</td>
                          <td className="px-5 py-3 text-slate-500">{h.reportType}</td>
                          <td className="px-5 py-3 text-right text-slate-400">{h.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          <div className="mb-5 overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: "1px solid #DFC0B2" }}>
            <div className="flex items-center gap-2 border-b px-5 py-4" style={{ borderColor: "#DFC0B2", backgroundColor: "#F3F3F3" }}>
              <Ms name="filter_list" style={{ color: "#F27123" }} />
              <h3 className="text-base font-bold text-[#1A1C1C]">Cấu hình báo cáo</h3>
            </div>
            <div className="flex flex-wrap items-end gap-3 p-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Loại báo cáo</label>
                <select value={reportType} onChange={(e) => { setReportType(e.target.value); setDataset(null); }} className={selectCls}>
                  {reportTypeOptions.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>

              {!NEEDS_NO_CLASS.includes(reportType) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Lớp</label>
                  <select value={classId} onChange={(e) => { setSelectedClassId(e.target.value); setStudentId(""); }} className={selectCls}>
                    {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
                  </select>
                </div>
              )}

              {NEEDS_STUDENT.includes(reportType) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Học sinh</label>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={selectCls}>
                    <option value="">— Chọn —</option>
                    {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName}</option>)}
                  </select>
                </div>
              )}

              {reportType === "EFFICIENCY" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Nhóm theo</label>
                  <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={selectCls}>
                    {Object.entries(GROUP_BY_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
              )}

              {(NEEDS_SEMESTER.includes(reportType) || (reportType === "EFFICIENCY" && groupBy === "GRADE")) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Học kỳ</label>
                  <select value={semesterId} onChange={(e) => setSelectedSemesterId(e.target.value)} className={selectCls}>
                    {semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
                  </select>
                </div>
              )}

              {NEEDS_DATERANGE.includes(reportType) && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">Từ ngày</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={selectCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">Đến ngày</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={selectCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">Nhanh</label>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => applyPreset(7)} className="rounded-full border border-[#FFE7D6] px-2.5 py-2 text-xs hover:bg-[#FFF7F2]">7 ngày</button>
                      <button type="button" onClick={() => applyPreset(30)} className="rounded-full border border-[#FFE7D6] px-2.5 py-2 text-xs hover:bg-[#FFF7F2]">30 ngày</button>
                      <button type="button" onClick={applySemesterRange} className="rounded-full border border-[#FFE7D6] px-2.5 py-2 text-xs hover:bg-[#FFF7F2]">Học kỳ</button>
                    </div>
                  </div>
                </>
              )}

              <button type="button" onClick={handleGenerate} disabled={loading}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
                {loading ? "Đang tạo..." : "Tạo báo cáo"}
              </button>
            </div>
          </div>

          {error && <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          {dataset && (
            <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6" }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "#0F2747" }}>{dataset.title}</h2>
                  <p className="text-xs text-slate-500">{dataset.filtersLabel} · {dataset.generatedAt}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleExcel} disabled={exporting}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#15803D" }}>
                    <Ms name="table_view" className="text-[16px]!" /> {exporting ? "..." : "Excel"}
                  </button>
                  <button type="button" onClick={handlePdf}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: "#00458E" }}>
                    <Ms name="picture_as_pdf" className="text-[16px]!" /> In / PDF
                  </button>
                </div>
              </div>

              {dataset.sections.map((section, si) => (
                <div key={si} className="mb-6">
                  <h3 className="mb-2 text-sm font-bold" style={{ color: "#F27123" }}>{section.heading}</h3>
                  <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #DFC0B2" }}>
                    <table className="min-w-full text-sm">
                      <thead className="text-white" style={{ backgroundColor: "#00458E" }}>
                        <tr>
                          {section.columns.map((c) => <th key={c.key} className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider">{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: "#DFC0B2" }}>
                        {section.rows.length === 0 ? (
                          <tr><td colSpan={section.columns.length} className="px-3 py-4 text-center text-sm text-slate-400">Không có dữ liệu</td></tr>
                        ) : section.rows.map((row, ri) => (
                          <tr key={ri} className="transition-colors hover:bg-[#F3F3F3]">
                            {section.columns.map((c) => <td key={c.key} className="px-3 py-2.5 text-[#1A1C1C]">{row[c.key] ?? "—"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {section.summary?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {section.summary.map((s, i) => (
                        <div key={i} className="rounded-3xl px-4 py-2 text-sm" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>
                          <span className="text-slate-500">{s.label}: </span>
                          <span className="font-bold" style={{ color: "#0F2747" }}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default AdminReportsPage;
