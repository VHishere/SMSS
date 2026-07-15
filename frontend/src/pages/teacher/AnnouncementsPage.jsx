import { useEffect, useMemo, useState } from "react";

import DashboardShell from "../../components/templates/DashboardShell";
import AnnouncementFormModal from "../../components/organisms/AnnouncementFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { announcementApi, communicationApi } from "../../api/client";
import { formatDateTimeVN } from "../../utils/datetime";

// ─── FSchool Stitch design tokens ────────────────────────────────────────────
const C = {
  onSurface: "#1A1C1C",
  muted: "#584238",
  border: "#DFC0B2",
  orange: "#F27123",
  secondary: "#225DAD",
  deepBlue: "#00458E",
  success: "#15803D",
  surface: "#F9F9F9",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};

function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

const STATUS = {
  DRAFT:     { label: "Nháp",         bg: "#E8E8E8", text: "#584238" },
  SCHEDULED: { label: "Đã lên lịch",  bg: "#FEF3C7", text: "#B45309" },
  PUBLISHED: { label: "Đã phát hành", bg: "#DCFCE7", text: "#15803D" },
  ARCHIVED:  { label: "Lưu trữ",      bg: "#FFDAD6", text: "#93000A" },
};
const AUDIENCE_LABEL = { CLASS_ALL: "Cả lớp", CLASS_PARENTS: "Phụ huynh", CLASS_STUDENTS: "Học sinh" };
const FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "DRAFT", label: "Nháp" },
  { key: "SCHEDULED", label: "Đã lên lịch" },
  { key: "PUBLISHED", label: "Đã phát hành" },
  { key: "ARCHIVED", label: "Lưu trữ" },
];

function AnnouncementsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState([]);
  const [modal, setModal] = useState(null);
  const [receipts, setReceipts] = useState(null);
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
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Trung tâm thông báo</h2>
        <button type="button" onClick={() => setModal({})} disabled={classes.length === 0}
          className="flex items-center gap-2 rounded-full px-6 py-3 font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
          <Ms name="campaign" className="!text-[20px]" /> Tạo thông báo
        </button>
      </div>

      {/* Status filter pills */}
      <div className="mb-6 flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
        {FILTERS.map((f) => (
          <button key={f.key || "ALL"} type="button" onClick={() => setStatusFilter(f.key)}
            className="rounded-full px-4 py-1.5 text-sm transition-all"
            style={statusFilter === f.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}

      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            Chưa có thông báo nào.
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((a) => {
              const st = STATUS[a.status] ?? STATUS.DRAFT;
              const editable = a.status === "DRAFT" || a.status === "SCHEDULED";
              return (
                <div key={a.announcementId} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeftWidth: a.isPinned ? 4 : 1, borderLeftColor: a.isPinned ? C.orange : C.border }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.orange }}>
                        <Ms name="campaign" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {a.isPinned && <Ms name="push_pin" className="!text-[14px]" style={{ color: C.orange }} />}
                          <h3 className="text-sm font-bold" style={{ color: C.onSurface }}>{a.title}</h3>
                        </div>
                        <p className="text-xs text-slate-400">
                          {a.className ?? "—"} · {AUDIENCE_LABEL[a.audience]} ·{" "}
                          {a.status === "SCHEDULED" ? `lên lịch ${formatDateTimeVN(a.scheduledAt)}` : a.status === "PUBLISHED" ? `phát hành ${formatDateTimeVN(a.publishedAt)}` : `tạo ${formatDateTimeVN(a.createdAt)}`}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                  </div>
                  {a.content && <p className="mt-2 line-clamp-2 pl-[52px] text-sm text-slate-600">{a.content}</p>}

                  {a.status !== "ARCHIVED" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {editable && (
                        <>
                          <button type="button" onClick={() => act(() => announcementApi.publish(a.announcementId))}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: C.success }}>
                            <Ms name="send" className="!text-[14px]" /> Phát hành
                          </button>
                          <button type="button" onClick={() => setModal({ announcement: a })}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>
                            <Ms name="edit" className="!text-[14px]" /> Sửa
                          </button>
                        </>
                      )}
                      {a.status === "PUBLISHED" && (
                        <button type="button" onClick={() => openReceipts(a)}
                          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>
                          <Ms name="visibility" className="!text-[14px]" /> Đã đọc
                        </button>
                      )}
                      <button type="button" onClick={() => act(() => announcementApi.pin(a.announcementId, !a.isPinned))}
                        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.orange }}>
                        <Ms name="push_pin" className="!text-[14px]" /> {a.isPinned ? "Bỏ ghim" : "Ghim"}
                      </button>
                      <button type="button" onClick={() => act(() => announcementApi.archive(a.announcementId))}
                        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: C.surfaceHigh, color: C.muted }}>
                        <Ms name="archive" className="!text-[14px]" /> Lưu trữ
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
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-xl" style={{ border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Tình trạng đã đọc</h3>
                <p className="truncate text-xs text-slate-500">{receipts.announcement.title}</p>
              </div>
              <button type="button" onClick={() => setReceipts(null)} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {receipts.loading ? (
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ) : receipts.error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{receipts.error}</p>
              ) : receipts.data && (
                <>
                  <div className="mb-4 flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-extrabold leading-none" style={{ color: C.orange }}>{receipts.data.readRate ?? 0}%</p>
                      <p className="mt-1 text-xs text-slate-500">đã đọc</p>
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Đã đọc: {receipts.data.readCount}</span><span>Tổng: {receipts.data.total}</span></div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${receipts.data.readRate ?? 0}%`, backgroundColor: C.orange }} /></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {receipts.data.recipients.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: C.surfaceLow }}>
                        <span style={{ color: C.onSurface }}>{r.name}</span>
                        {r.isRead
                          ? <span className="flex items-center gap-1 text-xs font-medium" style={{ color: C.success }}><Ms name="check_circle" className="!text-[13px]" /> Đã đọc</span>
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
