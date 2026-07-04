import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiDownload, FiPrinter } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { reportApi, studentProfileApi } from "../../api/client";
import { useReportMeta } from "../../hooks/useReportMeta";
import { printReport } from "../../utils/printReport";

const REPORT_LABEL = {
  ATTENDANCE: "Báo cáo chuyên cần",
  ACADEMIC: "Báo cáo học tập",
  BEHAVIOUR: "Báo cáo hạnh kiểm",
  PROGRESS: "Báo cáo tiến bộ học sinh",
  CLASS_SUMMARY: "Báo cáo tổng hợp lớp",
};
const NEEDS_SEMESTER = ["ACADEMIC", "BEHAVIOUR", "PROGRESS", "CLASS_SUMMARY"];
const NEEDS_STUDENT = ["PROGRESS"];
const NEEDS_DATERANGE = ["ATTENDANCE"];

const selectCls =
  "rounded-lg border border-[#FFE7D6] bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

function isoToday() { return new Date().toISOString().slice(0, 10); }
function isoDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

function ReportBuilderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportType = searchParams.get("type") || "ATTENDANCE";
  const templateId = searchParams.get("templateId");

  const { data: meta, loading: metaLoading } = useReportMeta();

  const [classId,    setClassId]    = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [studentId,  setStudentId]  = useState("");
  const [startDate,  setStartDate]  = useState(isoDaysAgo(7));
  const [endDate,    setEndDate]    = useState(isoToday());
  const [students,   setStudents]   = useState([]);

  const [dataset,  setDataset]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [exporting, setExporting] = useState(false);

  const [showSave, setShowSave] = useState(false);
  const [tplName,  setTplName]  = useState("");
  const [tplSchedule, setTplSchedule] = useState("NONE");
  const [saveMsg,  setSaveMsg]  = useState("");

  const classes   = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];

  // defaults once meta loads
  useEffect(() => {
    if (!meta) return;
    if (classes.length && !classId) setClassId(String(classes[0].classId));
    if (semesters.length && !semesterId) setSemesterId(String(semesters[0].semesterId));
  }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps

  // load students when class changes (for PROGRESS)
  useEffect(() => {
    if (!NEEDS_STUDENT.includes(reportType) || !classId) return;
    let m = true;
    studentProfileApi.getClassOverview(classId, semesterId)
      .then((res) => { if (m) { setStudents(res.data.students); if (!studentId && res.data.students[0]) setStudentId(String(res.data.students[0].studentId)); } })
      .catch(() => {});
    return () => { m = false; };
  }, [reportType, classId, semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-run a saved template
  useEffect(() => {
    if (!templateId) return;
    let m = true;
    setLoading(true); setError("");
    reportApi.runTemplate(templateId)
      .then((res) => { if (m) setDataset(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [templateId]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  function buildFilters() {
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
      const res = await reportApi.generate(reportType, buildFilters());
      setDataset(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExcel() {
    setExporting(true);
    try { await reportApi.exportExcel(reportType, buildFilters()); }
    catch (err) { setError(err.message); }
    finally { setExporting(false); }
  }

  async function handlePdf() {
    if (!dataset) return;
    printReport(dataset);
    try { await reportApi.logExport(reportType, buildFilters(), "PDF"); } catch { /* logging non-critical */ }
  }

  async function handleSaveTemplate() {
    if (!tplName.trim()) { setSaveMsg("Nhập tên mẫu"); return; }
    try {
      await reportApi.createTemplate({ name: tplName.trim(), reportType, config: buildFilters(), schedule: tplSchedule });
      setShowSave(false); setTplName(""); setTplSchedule("NONE"); setSaveMsg("");
    } catch (err) { setSaveMsg(err.message); }
  }

  function applyPreset(days) { setStartDate(isoDaysAgo(days)); setEndDate(isoToday()); }
  function applySemesterRange() {
    const sem = semesters.find((s) => String(s.semesterId) === String(semesterId)) ?? semesters[0];
    if (sem) { setStartDate(sem.startDate); setEndDate(sem.endDate); }
  }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Báo cáo" sidebarFooterValue={REPORT_LABEL[reportType] ?? ""}>
      <button type="button" onClick={() => navigate("/teacher/reports")} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#0F2747]">
        <FiArrowLeft size={15} /> Về trung tâm báo cáo
      </button>

      <h1 className="mb-6 text-xl font-bold sm:text-2xl" style={{ color: "#0F2747" }}>{REPORT_LABEL[reportType] ?? "Báo cáo"}</h1>

      {metaLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <>
          {/* Filters */}
          <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Lớp</label>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(""); }} className={selectCls}>
                  {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
                </select>
              </div>

              {NEEDS_STUDENT.includes(reportType) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Học sinh</label>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={selectCls}>
                    <option value="">— Chọn —</option>
                    {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName}</option>)}
                  </select>
                </div>
              )}

              {NEEDS_SEMESTER.includes(reportType) && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Học kỳ</label>
                  <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} className={selectCls}>
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
                      <button type="button" onClick={() => applyPreset(7)} className="rounded-lg border border-[#FFE7D6] px-2.5 py-2 text-xs hover:bg-[#FFF7F2]">7 ngày</button>
                      <button type="button" onClick={() => applyPreset(30)} className="rounded-lg border border-[#FFE7D6] px-2.5 py-2 text-xs hover:bg-[#FFF7F2]">30 ngày</button>
                      <button type="button" onClick={applySemesterRange} className="rounded-lg border border-[#FFE7D6] px-2.5 py-2 text-xs hover:bg-[#FFF7F2]">Học kỳ</button>
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

          {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          {/* Preview + export */}
          {dataset && (
            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6" }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "#0F2747" }}>{dataset.title}</h2>
                  <p className="text-xs text-slate-500">{dataset.filtersLabel} · {dataset.generatedAt}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleExcel} disabled={exporting}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50" style={{ backgroundColor: "#16A34A" }}>
                    <FiDownload size={14} /> {exporting ? "..." : "Excel"}
                  </button>
                  <button type="button" onClick={handlePdf}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition" style={{ backgroundColor: "#08509F" }}>
                    <FiPrinter size={14} /> In / PDF
                  </button>
                  <button type="button" onClick={() => setShowSave(true)}
                    className="rounded-full border border-[#FFE7D6] px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#FFF7F2]">
                    Lưu mẫu
                  </button>
                </div>
              </div>

              {dataset.sections.map((section, si) => (
                <div key={si} className="mb-6">
                  <h3 className="mb-2 text-sm font-bold" style={{ color: "#F27123" }}>{section.heading}</h3>
                  <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #FFE7D6" }}>
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: "#FFF7F2" }}>
                          {section.columns.map((c) => <th key={c.key} className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: "#F27123" }}>{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.length === 0 ? (
                          <tr><td colSpan={section.columns.length} className="px-3 py-4 text-center text-sm text-slate-400">Không có dữ liệu</td></tr>
                        ) : section.rows.map((row, ri) => (
                          <tr key={ri} className={`transition hover:bg-[#FFF0E8] ${ri % 2 ? "bg-[#FFF7F2]" : "bg-white"}`}>
                            {section.columns.map((c) => <td key={c.key} className="px-3 py-2 text-[#0F2747]">{row[c.key] ?? "—"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {section.summary?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {section.summary.map((s, i) => (
                        <div key={i} className="rounded-xl px-4 py-2 text-sm" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>
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

      {/* Save template modal */}
      {showSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
            <h3 className="mb-4 text-base font-bold" style={{ color: "#0F2747" }}>Lưu mẫu báo cáo</h3>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tên mẫu</label>
            <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="VD: Chuyên cần 10B1 hàng tuần" className={`${selectCls} mb-3 w-full`} />
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Lịch chạy</label>
            <select value={tplSchedule} onChange={(e) => setTplSchedule(e.target.value)} className={`${selectCls} mb-4 w-full`}>
              <option value="NONE">Không lập lịch</option>
              <option value="DAILY">Hàng ngày</option>
              <option value="WEEKLY">Hàng tuần</option>
              <option value="MONTHLY">Hàng tháng</option>
            </select>
            {saveMsg && <p className="mb-3 text-xs text-red-600">{saveMsg}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowSave(false)} className="flex-1 rounded-full border border-[#FFE7D6] py-2.5 text-sm font-medium text-slate-600 hover:bg-[#FFF7F2]">Hủy</button>
              <button type="button" onClick={handleSaveTemplate} className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#F27123" }}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default ReportBuilderPage;
