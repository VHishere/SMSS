import { useEffect, useMemo, useState } from "react";
import { FiArchive, FiCheckCircle, FiEdit3, FiEye, FiPlus, FiSend, FiStar, FiX } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import AnnouncementFormModal from "../../components/organisms/AnnouncementFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { announcementApi, communicationApi } from "../../api/client";

const STATUS = {
  DRAFT:     { label: "Nháp",        bg: "#F1F5F9", text: "#475569" },
  SCHEDULED: { label: "Đã lên lịch", bg: "#FFFBEB", text: "#F59E0B" },
  PUBLISHED: { label: "Đã phát hành", bg: "#ECFDF5", text: "#16A34A" },
  ARCHIVED:  { label: "Lưu trữ",     bg: "#FEF2F2", text: "#DC2626" },
};
const AUDIENCE_LABEL = { CLASS_ALL: "Cả lớp", CLASS_PARENTS: "Phụ huynh", CLASS_STUDENTS: "Học sinh" };

function AnnouncementsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState([]);
  const [modal, setModal] = useState(null); // { announcement? }
  const [receipts, setReceipts] = useState(null); // { announcement, data, loading }
  const [refresh, setRefresh] = useState(0);

  async function openReceipts(a) {
    setReceipts({ announcement: a, data: null, loading: true });
    try {
      const res = await announcementApi.getReceipts(a.announcementId);
      setReceipts({ announcement: a, data: res.data, loading: false });
    } catch (err) {
      setReceipts({ announcement: a, data: null, loading: false, error: err.message });
    }
  }

  useEffect(() => {
    let m = true;
    communicationApi.getContacts().then((res) => { if (m) setClasses(res.data.classes); }).catch(() => {});
    return () => { m = false; };
  }, []);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    announcementApi.list({ status: statusFilter, limit: 30 })
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [statusFilter, refresh]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  async function act(fn) {
    try { await fn(); setRefresh((k) => k + 1); }
    catch (err) { alert(err.message); }
  }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Khu vực" sidebarFooterValue="Thông báo">
      <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
          <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Trung tâm thông báo</h1>
          <p className="text-sm text-slate-500">Tạo, lên lịch, ghim và phát hành thông báo tới phụ huynh/học sinh.</p>
        </div>
        <button type="button" onClick={() => setModal({})} disabled={classes.length === 0}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
          <FiPlus size={15} /> Tạo thông báo
        </button>
      </section>

      <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {["", "DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].map((s) => (
          <button key={s || "ALL"} type="button" onClick={() => setStatusFilter(s)}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
            style={statusFilter === s ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
            {s === "" ? "Tất cả" : STATUS[s].label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="space-y-2">{[0,1,2].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>}

      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            Chưa có thông báo nào.
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((a) => {
              const st = STATUS[a.status] ?? STATUS.DRAFT;
              const editable = a.status === "DRAFT" || a.status === "SCHEDULED";
              return (
                <div key={a.announcementId} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {a.isPinned && <FiStar size={14} style={{ color: "#F59E0B", fill: "#F59E0B" }} />}
                        <h3 className="text-sm font-bold text-[#0F2747]">{a.title}</h3>
                      </div>
                      <p className="text-xs text-slate-400">
                        {a.className ?? "—"} · {AUDIENCE_LABEL[a.audience]} ·{" "}
                        {a.status === "SCHEDULED" ? `lên lịch ${a.scheduledAt}` : a.status === "PUBLISHED" ? `phát hành ${a.publishedAt}` : `tạo ${a.createdAt}`}
                      </p>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                  </div>
                  {a.content && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.content}</p>}

                  {a.status !== "ARCHIVED" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {editable && (
                        <>
                          <button type="button" onClick={() => act(() => announcementApi.publish(a.announcementId))}
                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "#16A34A" }}>
                            <FiSend size={11} /> Phát hành
                          </button>
                          <button type="button" onClick={() => setModal({ announcement: a })}
                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>
                            <FiEdit3 size={11} /> Sửa
                          </button>
                        </>
                      )}
                      {a.status === "PUBLISHED" && (
                        <button type="button" onClick={() => openReceipts(a)}
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>
                          <FiEye size={11} /> Đã đọc
                        </button>
                      )}
                      <button type="button" onClick={() => act(() => announcementApi.pin(a.announcementId, !a.isPinned))}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "#FFF7F2", color: "#F27123" }}>
                        <FiStar size={11} /> {a.isPinned ? "Bỏ ghim" : "Ghim"}
                      </button>
                      <button type="button" onClick={() => act(() => announcementApi.archive(a.announcementId))}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>
                        <FiArchive size={11} /> Lưu trữ
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {modal && (
        <AnnouncementFormModal classes={classes} announcement={modal.announcement}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); setRefresh((k) => k + 1); }} />
      )}

      {receipts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>Tình trạng đã đọc</h3>
                <p className="truncate text-xs text-slate-500">{receipts.announcement.title}</p>
              </div>
              <button type="button" onClick={() => setReceipts(null)} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {receipts.loading ? (
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ) : receipts.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{receipts.error}</p>
              ) : receipts.data && (
                <>
                  <div className="mb-4 flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold leading-none" style={{ color: "#F27123" }}>{receipts.data.readRate ?? 0}%</p>
                      <p className="mt-1 text-xs text-slate-500">đã đọc</p>
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Đã đọc: {receipts.data.readCount}</span><span>Tổng: {receipts.data.total}</span></div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${receipts.data.readRate ?? 0}%`, backgroundColor: "#F27123" }} /></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {receipts.data.recipients.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "#FFF7F2" }}>
                        <span className="text-[#0F2747]">{r.name}</span>
                        {r.isRead
                          ? <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#16A34A" }}><FiCheckCircle size={12} /> Đã đọc</span>
                          : <span className="text-xs text-slate-400">Chưa đọc</span>}
                      </div>
                    ))}
                    {receipts.data.recipients.length === 0 && <p className="text-sm text-slate-400">Chưa có người nhận.</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default AnnouncementsPage;
