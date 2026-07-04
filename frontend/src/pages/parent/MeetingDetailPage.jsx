import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FiArrowLeft, FiCheckSquare, FiClock, FiFileText, FiInfo, FiMail,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { parentMeetingApi } from "../../api/client";
import { useParentStudents } from "../../hooks/useParentStudents";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

const TABS = [
  { key: "info",    label: "Thông tin",     icon: FiInfo },
  { key: "minutes", label: "Biên bản",      icon: FiFileText },
  { key: "actions", label: "Việc cần làm",  icon: FiCheckSquare },
  { key: "log",     label: "Nhật ký",       icon: FiClock },
];
const MEETING_STATUS = {
  SCHEDULED: { label: "Đã lên lịch", bg: "#FFFBEB", text: "#F59E0B" },
  COMPLETED: { label: "Hoàn thành",  bg: "#ECFDF5", text: "#16A34A" },
  CANCELLED: { label: "Đã hủy",      bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED:  { label: "Lưu trữ",     bg: "#F1F5F9", text: "#475569" },
};
const INVITE_STATUS = {
  SENT:     { label: "Đã gửi",        bg: "#EBF3FF", text: "#08509F" },
  PENDING:  { label: "Chờ",           bg: "#FFFBEB", text: "#F59E0B" },
  ACCEPTED: { label: "Đã xác nhận",   bg: "#ECFDF5", text: "#16A34A" },
  DECLINED: { label: "Từ chối",       bg: "#FEF2F2", text: "#DC2626" },
};
const ACTION_STATUS = {
  PENDING:     { label: "Chờ",          bg: "#F1F5F9", text: "#475569" },
  IN_PROGRESS: { label: "Đang làm",     bg: "#FFFBEB", text: "#F59E0B" },
  COMPLETED:   { label: "Hoàn thành",   bg: "#ECFDF5", text: "#16A34A" },
};

function MeetingDetailPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { students } = useParentStudents();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "info";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [respondMsg, setRespondMsg] = useState({ text: "", ok: true });

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    parentMeetingApi.getDetail(meetingId)
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [meetingId]);

  async function handleRespond(action) {
    setResponding(true); setRespondMsg({ text: "", ok: true });
    try {
      const res = await parentMeetingApi.respond(meetingId, action);
      const newStatus = action === "ACCEPT" ? "ACCEPTED" : "DECLINED";
      setRespondMsg({ text: res.message ?? (action === "ACCEPT" ? "Đã xác nhận tham dự" : "Đã từ chối lời mời"), ok: true });
      setData((prev) => ({
        ...prev,
        meeting: { ...prev.meeting, invitationStatus: newStatus },
        invitations: prev.invitations.map((inv) =>
          inv.userId === user.userId ? { ...inv, status: newStatus } : inv
        ),
      }));
    } catch (err) {
      setRespondMsg({ text: err.message ?? "Có lỗi xảy ra", ok: false });
    } finally {
      setResponding(false);
    }
  }

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Phụ huynh",
    role: "Phụ huynh",
    avatar: user?.avatar ?? "",
  }), [user]);

  function setTab(key) { setSearchParams({ tab: key }); }

  const meeting = data?.meeting;

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      <button
        type="button"
        onClick={() => navigate("/parent/meetings")}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#0F2747]"
      >
        <FiArrowLeft size={15} /> Về danh sách
      </button>

      {loading && (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && meeting && (
        <>
          {/* Header */}
          <section
            className="mb-6 rounded-2xl p-5 shadow-sm sm:p-6"
            style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: MEETING_STATUS[meeting.status]?.bg, color: MEETING_STATUS[meeting.status]?.text }}
                  >
                    {MEETING_STATUS[meeting.status]?.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {meeting.meetingType === "INDIVIDUAL" ? "Họp cá nhân" : "Họp lớp"}
                  </span>
                  {meeting.invitationStatus && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: INVITE_STATUS[meeting.invitationStatus]?.bg, color: INVITE_STATUS[meeting.invitationStatus]?.text }}
                    >
                      {INVITE_STATUS[meeting.invitationStatus]?.label}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold" style={{ color: "#0F2747" }}>{meeting.title}</h1>
                <p className="text-sm text-slate-500">
                  {meeting.meetingDate}{meeting.endTime ? ` – ${meeting.endTime.slice(11)}` : ""}
                  {meeting.className ? ` · ${meeting.className}` : ""}
                  {meeting.location ? ` · ${meeting.location}` : ""}
                  {meeting.studentName ? ` · HS: ${meeting.studentName}` : ""}
                </p>
              </div>

              {meeting.status === "SCHEDULED" && ["SENT", "PENDING"].includes(meeting.invitationStatus) && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={responding}
                    onClick={() => handleRespond("ACCEPT")}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                    style={{ backgroundColor: "#16A34A" }}
                  >
                    {responding ? "..." : "Xác nhận tham dự"}
                  </button>
                  <button
                    type="button"
                    disabled={responding}
                    onClick={() => handleRespond("DECLINE")}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
                    style={{ borderColor: "#DC2626", color: "#DC2626" }}
                  >
                    {responding ? "..." : "Từ chối"}
                  </button>
                </div>
              )}
            </div>

            {respondMsg.text && (
              <p
                className="mt-3 rounded-lg px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: respondMsg.ok ? "#ECFDF5" : "#FEF2F2", color: respondMsg.ok ? "#16A34A" : "#DC2626" }}
              >
                {respondMsg.text}
              </p>
            )}
            {meeting.content && (
              <p
                className="mt-3 rounded-xl px-4 py-3 text-sm text-slate-600"
                style={{ backgroundColor: "#FFF7F2" }}
              >
                {meeting.content}
              </p>
            )}
          </section>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition"
                style={activeTab === key ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}
              >
                <Icon size={15} /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div
            className="rounded-2xl bg-white p-5 shadow-sm sm:p-6"
            style={{ border: "1px solid #FFE7D6" }}
          >
            {activeTab === "info"    && <InfoTab invitations={data.invitations} />}
            {activeTab === "minutes" && <MinutesTab minutes={data.minutes} />}
            {activeTab === "actions" && <ActionsTab actions={data.actions} />}
            {activeTab === "log"     && <LogTab logs={data.logs} />}
          </div>
        </>
      )}
    </DashboardShell>
  );
}

// ── Invitations (read-only) ───────────────────────────────────────────────────

function InfoTab({ invitations }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "#0F2747" }}>
        <FiMail size={15} /> Người tham dự ({invitations.length})
      </h3>
      <div className="space-y-2">
        {invitations.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có người tham dự.</p>
        ) : invitations.map((inv) => {
          const st = INVITE_STATUS[inv.status] ?? INVITE_STATUS.SENT;
          return (
            <div
              key={inv.invitationId}
              className="flex items-center justify-between gap-2 rounded-xl px-4 py-2.5"
              style={{ border: "1px solid #FFE7D6" }}
            >
              <div>
                <p className="text-sm font-medium text-[#0F2747]">{inv.name}</p>
                <p className="text-xs text-slate-400">
                  {inv.studentName ? `PH của ${inv.studentName} · ` : ""}{inv.phone ?? ""}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: st.bg, color: st.text }}
              >
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Minutes (read-only) ───────────────────────────────────────────────────────

function MinutesTab({ minutes }) {
  if (!minutes) {
    return <p className="text-sm text-slate-400">Chưa có biên bản.</p>;
  }
  return (
    <div className="space-y-4">
      {minutes.isSubmitted && (
        <div
          className="rounded-xl px-3 py-2 text-xs font-medium"
          style={{ backgroundColor: "#ECFDF5", color: "#16A34A" }}
        >
          Biên bản đã chốt lúc {minutes.submittedAt}
        </div>
      )}
      {[
        ["Nội dung thảo luận", minutes.discussion],
        ["Thống nhất", minutes.agreements],
        ["Quyết định", minutes.decisions],
      ].map(([label, val]) => (
        <div key={label}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p
            className="whitespace-pre-wrap rounded-xl px-4 py-3 text-sm text-slate-700"
            style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}
          >
            {val || "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Actions (read-only) ───────────────────────────────────────────────────────

function ActionsTab({ actions }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>
        Việc cần làm ({actions.length})
      </h3>
      <div className="space-y-2">
        {actions.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có việc nào.</p>
        ) : actions.map((a) => {
          const st = ACTION_STATUS[a.status] ?? ACTION_STATUS.PENDING;
          return (
            <div
              key={a.actionId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
              style={{ border: "1px solid #FFE7D6" }}
            >
              <div>
                <p className="text-sm font-medium text-[#0F2747]">{a.title}</p>
                <p className="text-xs text-slate-400">
                  Hạn {a.deadline}{a.assigneeName ? ` · ${a.assigneeName}` : ""}
                  {a.isOverdue && (
                    <span className="ml-1 font-semibold" style={{ color: "#DC2626" }}>· Quá hạn</span>
                  )}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: st.bg, color: st.text }}
              >
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Log (read-only) ───────────────────────────────────────────────────────────

function LogTab({ logs }) {
  if (!logs.length) return <p className="text-sm text-slate-400">Chưa có hoạt động.</p>;
  return (
    <div className="space-y-2">
      {logs.map((l, i) => (
        <div
          key={i}
          className="flex items-start justify-between gap-3 rounded-xl px-4 py-2.5"
          style={{ backgroundColor: "#FFF7F2" }}
        >
          <div>
            <p className="text-sm text-[#0F2747]">{l.detail || l.action}</p>
            <p className="text-xs text-slate-400">{l.changedByName}</p>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{l.createdAt}</span>
        </div>
      ))}
    </div>
  );
}

export default MeetingDetailPage;
