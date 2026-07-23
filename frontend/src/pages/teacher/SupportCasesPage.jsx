import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { supportCaseApi, studentProfileApi } from "../../api/client";
import { useStudentMeta } from "../../hooks/useStudentMeta";
import { formatDateTimeVN } from "../../utils/datetime";

const CATEGORY = { ACADEMIC: "Học tập", BEHAVIOUR: "Hạnh kiểm", ATTENDANCE: "Chuyên cần", PSYCHOLOGICAL: "Tâm lý", FAMILY: "Gia đình", OTHER: "Khác" };
const SEVERITY = { LOW: { label: "Thấp", bg: "#FFF7F2", text: "#F27123" }, MEDIUM: { label: "Trung bình", bg: "#FFFBEB", text: "#F59E0B" }, HIGH: { label: "Cao", bg: "#FEF2F2", text: "#DC2626" } };
const STATUS = {
  OPEN:       { label: "Đang xử lý",   dot: "#DC2626", bg: "#FEF2F2", text: "#DC2626" },
  MONITORING: { label: "Đang theo dõi", dot: "#225DAD", bg: "#EBF3FF", text: "#225DAD" },
  RESOLVED:   { label: "Đã giải quyết", dot: "#16A34A", bg: "#ECFDF5", text: "#16A34A" },
};
const STATUS_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "OPEN", label: "Đang xử lý" },
  { key: "MONITORING", label: "Đang theo dõi" },
  { key: "RESOLVED", label: "Đã giải quyết" },
];
const C = { onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", surfaceLow: "#F3F3F3" };
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}
function initials(n) { const p = (n || "").trim().split(/\s+/); return p.length ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() : "?"; }
const inputCls = "w-full rounded-xl border border-[#DFC0B2] bg-white px-3 py-2.5 text-sm text-[#1A1C1C] outline-none focus:ring-1 focus:ring-[#00458E]";
const PAGE_SIZE = 6;

function ActionCard({ icon, title, subtitle, color, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-3xl bg-white p-5 text-center shadow-sm transition hover:shadow-md active:scale-[0.99]" style={{ border: "1px solid #FFE7D6" }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}1A`, color }}>
        <Ms name={icon} className="!text-[24px]" />
      </div>
      <div>
        <p className="text-sm font-bold" style={{ color: C.onSurface }}>{title}</p>
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      </div>
    </button>
  );
}

function SupportCasesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: meta } = useStudentMeta();

  const [classF, setClassF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [createSeverity, setCreateSeverity] = useState("MEDIUM");
  const [detailCase, setDetailCase] = useState(null);

  // Hỗ trợ học sinh là nghiệp vụ GVCN → chỉ lớp chủ nhiệm.
  const classes = (meta?.classes ?? []).filter((c) => c.roleInClass === "HOMEROOM_TEACHER");

  // Lấy TẤT CẢ ca trong phạm vi (không lọc status ở API) để tính thống kê + lọc client-side.
  useEffect(() => {
    let m = true; setLoading(true); setError("");
    supportCaseApi.list({ classId: classF, status: "", limit: 200 })
      .then((res) => { if (m) { setData(res.data); setPage(1); } })
      .catch((e) => { if (m) setError(e.message || "Không thể tải danh sách"); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [classF, refresh]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const cases = useMemo(() => data?.items ?? [], [data]);

  // Thống kê real-time từ danh sách ca.
  const stats = useMemo(() => {
    const active = cases.filter((c) => c.status !== "RESOLVED");
    const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const now = new Date();
    const thisKey = `${now.getFullYear()}-${now.getMonth()}`;
    const lastKey = `${now.getFullYear()}-${now.getMonth() - 1}`;
    const openedThis = cases.filter((c) => monthKey(c.createdAt) === thisKey).length;
    const openedLast = cases.filter((c) => monthKey(c.createdAt) === lastKey).length;
    return {
      active: active.length,
      academic: active.filter((c) => c.category === "ACADEMIC").length,
      behaviour: active.filter((c) => c.category === "BEHAVIOUR").length,
      delta: openedThis - openedLast,
      priority: active.filter((c) => c.severity === "HIGH")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    };
  }, [cases]);

  const filtered = useMemo(
    () => (statusF ? cases.filter((c) => c.status === statusF) : cases),
    [cases, statusF],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate(severity = "MEDIUM") { setCreateSeverity(severity); setShowCreate(true); }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Hỗ trợ" sidebarFooterValue={String(stats.active)}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Quản lý hỗ trợ học sinh</h1>
        <button type="button" onClick={() => openCreate("MEDIUM")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: C.orange }}>
          <Ms name="add" className="!text-[18px]" /> Tạo ca hỗ trợ mới
        </button>
      </div>

      {error && <div className="mb-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="h-40 animate-pulse rounded-3xl bg-slate-100 lg:col-span-2" />
            <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
          </div>
          <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      ) : (
        <>
          {/* Top: Học sinh cần lưu ý (trái) + thẻ cam thống kê (phải) */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-3xl bg-white p-5 shadow-sm lg:col-span-2" style={{ border: "1px solid #FFE7D6" }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ms name="warning" className="!text-[20px]" style={{ color: C.orange }} />
                  <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Học sinh cần lưu ý</h3>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: C.surfaceLow, color: C.muted }}>{stats.priority.length} trường hợp ưu tiên</span>
              </div>
              {stats.priority.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Không có trường hợp ưu tiên (mức Cao) nào đang mở.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {stats.priority.slice(0, 2).map((c) => (
                      <button key={c.caseId} type="button" onClick={() => setDetailCase(c)}
                        className="flex items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-[#F3F3F3]" style={{ border: "1px solid #DFC0B2" }}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}>{initials(c.studentName)}</div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" style={{ color: C.onSurface }}>{c.studentName}</p>
                          <p className="truncate text-xs" style={{ color: "#DC2626" }}>Khẩn cấp: {c.title}</p>
                        </div>
                        <Ms name="chevron_right" className="!text-[18px] ml-auto text-slate-300" />
                      </button>
                    ))}
                  </div>
                  {stats.priority.length > 2 && (
                    <button type="button" onClick={() => setStatusF("OPEN")} className="mt-3 w-full rounded-2xl py-2 text-center text-sm font-medium transition hover:bg-[#F3F3F3]" style={{ border: "1px solid #DFC0B2", color: C.secondary }}>
                      Xem tất cả cảnh báo ưu tiên
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Thẻ cam thống kê */}
            <div className="rounded-3xl p-5 text-white shadow-md" style={{ backgroundColor: C.orange }}>
              <p className="text-sm font-semibold">Hỗ trợ đang diễn ra</p>
              <p className="text-xs text-white/80">Các hoạt động can thiệp đang hoạt động</p>
              <p className="mt-3 text-5xl font-extrabold leading-none">{stats.active}</p>
              {stats.delta !== 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs text-white/90">
                  <Ms name={stats.delta > 0 ? "trending_up" : "trending_down"} className="!text-[14px]" />
                  {stats.delta > 0 ? "+" : ""}{stats.delta} so với tháng trước
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/15 p-3 text-center">
                  <p className="text-2xl font-bold">{stats.academic}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">Học tập</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-3 text-center">
                  <p className="text-2xl font-bold">{stats.behaviour}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">Hành vi</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bảng Danh mục Ca hỗ trợ */}
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "#FFE7D6" }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Danh mục Ca hỗ trợ</h3>
                <p className="text-xs text-slate-400">Danh sách đầy đủ các ca đang thực hiện và đã hoàn thành.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
                  {STATUS_FILTERS.map((f) => (
                    <button key={f.key || "ALL"} type="button" onClick={() => { setStatusF(f.key); setPage(1); }}
                      className="rounded-full px-3 py-1.5 text-xs transition-all"
                      style={statusF === f.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                {classes.length > 0 && (
                  <select value={classF} onChange={(e) => setClassF(e.target.value)} className="rounded-xl border border-[#DFC0B2] bg-white px-3 py-2 text-sm text-[#1A1C1C] shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]">
                    <option value="">Ca của tôi</option>
                    {classes.map((c) => <option key={c.classId} value={c.classId}>Lớp {c.className}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider">Họ tên học sinh</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Lớp</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Lý do hỗ trợ</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Trạng thái</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Cập nhật cuối</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "#F1E7DE" }}>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">Chưa có ca hỗ trợ nào.</td></tr>
                  ) : pageRows.map((c) => {
                    const st = STATUS[c.status] ?? STATUS.OPEN;
                    return (
                      <tr key={c.caseId} className="transition-colors hover:bg-[#FFF9F4]">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}>{initials(c.studentName)}</div>
                            <span className="font-medium" style={{ color: C.onSurface }}>{c.studentName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{c.className ?? "—"}</td>
                        <td className="px-4 py-3"><span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>{c.title}</span></td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-sm" style={{ color: st.text }}>
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: st.dot }} /> {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{formatDateTimeVN(c.updatedAt || c.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => setDetailCase(c)} className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-[#F3F3F3]" style={{ borderColor: C.border, color: C.onSurface }}>Chi tiết</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm" style={{ borderColor: "#FFE7D6", color: C.muted }}>
              <span>Hiển thị {pageRows.length} trên {filtered.length} ca{statusF ? " (đã lọc)" : " đang hoạt động"}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg p-1.5 transition hover:bg-[#E8E8E8] disabled:opacity-40"><Ms name="chevron_left" className="!text-[20px]" /></button>
                  <span className="text-sm">Trang {page} trên {totalPages}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg p-1.5 transition hover:bg-[#E8E8E8] disabled:opacity-40"><Ms name="chevron_right" className="!text-[20px]" /></button>
                </div>
              )}
            </div>
          </div>

          {/* 4 card thao tác */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <ActionCard icon="menu_book" title="Tài liệu hướng dẫn" subtitle="Giao thức can thiệp" color={C.secondary} onClick={() => navigate("/teacher/announcements")} />
            <ActionCard icon="forum" title="Liên lạc Nhân sự" subtitle="Kết nối với tư vấn viên" color={C.deepBlue} onClick={() => navigate("/teacher/messages")} />
            <ActionCard icon="assessment" title="Báo cáo trường hợp" subtitle="Tóm tắt hàng tháng" color="#7C3AED" onClick={() => navigate("/teacher/reports")} />
            <ActionCard icon="e911_emergency" title="Hỗ trợ khẩn cấp" subtitle="Can thiệp cấp bách" color="#DC2626" onClick={() => openCreate("HIGH")} />
          </div>
        </>
      )}

      {showCreate && (
        <CreateCaseModal classes={classes} defaultSeverity={createSeverity} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); setRefresh((k) => k + 1); }} />
      )}
      {detailCase && (
        <CaseDetailModal caseItem={detailCase} onClose={() => setDetailCase(null)} onChanged={() => setRefresh((k) => k + 1)} />
      )}
    </DashboardShell>
  );
}

function CreateCaseModal({ classes, defaultSeverity = "MEDIUM", onClose, onSaved }) {
  const [classId, setClassId] = useState(classes[0]?.classId ? String(classes[0].classId) : "");
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState("ACADEMIC");
  const [severity, setSeverity] = useState(defaultSeverity);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!classId) return;
    let m = true;
    studentProfileApi.getClassOverview(classId).then((res) => { if (m) { setStudents(res.data.students); setStudentId(String(res.data.students[0]?.studentId ?? "")); } }).catch(() => {});
    return () => { m = false; };
  }, [classId]);

  async function submit() {
    if (!studentId) { setErr("Chọn học sinh"); return; }
    if (!title.trim()) { setErr("Nhập tiêu đề"); return; }
    setBusy(true); setErr("");
    try {
      await supportCaseApi.create({ studentId: Number(studentId), category, severity, title: title.trim(), description: description || null });
      onSaved();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>Mở ca hỗ trợ</h3>
          <button type="button" onClick={onClose} className="text-slate-400 transition hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>
        <div className="space-y-3 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Lớp</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
                {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
              </select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Học sinh <span className="text-red-500">*</span></label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls}>
                <option value="">— Chọn —</option>
                {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Danh mục</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Mức độ</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputCls}>
                {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
          </div>
          <div><label className="mb-1 block text-xs font-medium text-slate-600">Tiêu đề <span className="text-red-500">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Sa sút học tập đột ngột" className={inputCls} /></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-600">Mô tả</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-none`} /></div>
          {err && <p className="rounded-3xl bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={submit} disabled={busy} className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>{busy ? "Đang lưu..." : "Mở ca"}</button>
        </div>
      </div>
    </div>
  );
}

function CaseDetailModal({ caseItem, onClose, onChanged }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const sev = SEVERITY[caseItem.severity] ?? SEVERITY.MEDIUM;
  const st = STATUS[caseItem.status] ?? STATUS.OPEN;

  useEffect(() => {
    let m = true; setLoading(true);
    supportCaseApi.getUpdates(caseItem.caseId).then((res) => { if (m) setUpdates(res.data); }).catch(() => {}).finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [caseItem.caseId, refresh]);

  async function submit() {
    if (!note.trim()) return;
    setBusy(true);
    try { await supportCaseApi.addUpdate(caseItem.caseId, { note: note.trim(), newStatus: newStatus || null }); setNote(""); setNewStatus(""); setRefresh((k) => k + 1); onChanged(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
        <div className="flex items-start justify-between gap-3 px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>{CATEGORY[caseItem.category] ?? caseItem.category}</span>
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: sev.bg, color: sev.text }}>{sev.label}</span>
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
            </div>
            <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>{caseItem.title}</h3>
            <p className="text-xs text-slate-500">{caseItem.studentName}{caseItem.studentCode ? ` · ${caseItem.studentCode}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-slate-400 transition hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Nhật ký can thiệp</p>
          {loading ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" /> : (
            updates.length === 0 ? <p className="text-sm text-slate-400">Chưa có cập nhật nào.</p> : (
              <div className="space-y-3">
                {updates.map((u, i) => {
                  const dot = u.newStatus ? (STATUS[u.newStatus]?.text ?? "#F27123") : "#CBD5E1";
                  return (
                    <div key={u.updateId} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
                        {i < updates.length - 1 && <div className="mt-1 w-px flex-1 bg-slate-200" />}
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#0F2747]">{u.authorName}{u.newStatus ? ` · → ${STATUS[u.newStatus]?.label ?? u.newStatus}` : ""}</span>
                          <span className="shrink-0 text-xs text-slate-400">{formatDateTimeVN(u.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600">{u.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        <div className="space-y-2 px-6 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ghi nhận tiến triển / can thiệp..." className={`${inputCls} resize-none`} />
          <div className="flex gap-2">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={inputCls}>
              <option value="">Giữ trạng thái</option>
              <option value="OPEN">Đang mở</option>
              <option value="MONITORING">Đang theo dõi</option>
              <option value="RESOLVED">Đã xử lý</option>
            </select>
            <button type="button" onClick={submit} disabled={busy || !note.trim()} className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>Cập nhật</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SupportCasesPage;
