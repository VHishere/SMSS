import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiPaperclip,
  FiUser,
  FiUsers,
  FiX,
  FiXCircle,
} from "react-icons/fi";

import { useLeaveRequestDetail } from "../../hooks/useLeaveRequestDetail";
import { formatDateVN, formatLeaveDateRange, formatLeavePeriods } from "../../utils/leaveTime";

const LEAVE_TYPE_LABEL = {
  SICK_LEAVE:   "Nghỉ ốm",
  FAMILY:       "Việc gia đình",
  FAMILY_LEAVE: "Việc gia đình",
  PERSONAL:     "Việc cá nhân",
  PERSONAL_LEAVE: "Việc cá nhân",
  OTHER:        "Khác",
};

const STATUS_CONFIG = {
  PENDING:  { label: "Chờ duyệt",  bg: "#FFFBEB", text: "#D97706" },
  APPROVED: { label: "Đã duyệt",   bg: "#ECFDF5", text: "#16A34A" },
  REJECTED: { label: "Đã từ chối", bg: "#FEF2F2", text: "#DC2626" },
};

function leaveTypeLabel(type) {
  if (!type) return "—";
  return LEAVE_TYPE_LABEL[type] ?? type;
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 py-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "#FFF7F2" }}
      >
        <Icon size={15} style={{ color: "#F27123" }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400">{label}</p>
        <div className="text-sm font-medium" style={{ color: "#0F2747" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function LeaveRequestDetailDrawer({
  leaveRequestId,
  refreshKey,
  onClose,
  onApprove,
  onReject,
}) {
  const { data, loading, error } = useLeaveRequestDetail(leaveRequestId, refreshKey);

  const statusCfg = data ? STATUS_CONFIG[data.status] : null;
  const isPending = data?.status === "PENDING";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        style={{ borderLeft: "1px solid #FFE7D6" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #FFE7D6" }}
        >
          <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>
            Chi tiết đơn xin nghỉ
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((n) => (
                <div key={n} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Status + student header */}
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                  style={{ backgroundColor: "#08509F" }}
                >
                  {data.studentAvatar ? (
                    <img src={data.studentAvatar} alt={data.studentName} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    data.studentName?.[0]?.toUpperCase() ?? "?"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold" style={{ color: "#0F2747" }}>
                    {data.studentName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {data.studentCode} · {data.className ?? "—"}
                  </p>
                </div>
                {statusCfg && (
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                  >
                    {statusCfg.label}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="rounded-xl px-3" style={{ border: "1px solid #FFE7D6" }}>
                <InfoRow icon={FiFileText} label="Loại nghỉ phép">
                  {leaveTypeLabel(data.leaveType)}
                </InfoRow>
                <div style={{ borderTop: "1px solid #FFF7F2" }} />
                <InfoRow icon={FiCalendar} label="Ngày nghỉ">
                  {formatLeaveDateRange(data.startDate, data.endDate)}
                </InfoRow>
                <div style={{ borderTop: "1px solid #FFF7F2" }} />
                <InfoRow icon={FiClock} label="Tiết nghỉ">
                  {formatLeavePeriods(data.startDate, data.endDate) || "—"}
                </InfoRow>
                <div style={{ borderTop: "1px solid #FFF7F2" }} />
                <InfoRow icon={FiUsers} label="Lớp">
                  {data.className ?? "—"}
                  {data.gradeName && <span className="text-slate-400"> · {data.gradeName}</span>}
                  {data.roomName && <span className="text-slate-400"> · Phòng {data.roomName}</span>}
                </InfoRow>
                <div style={{ borderTop: "1px solid #FFF7F2" }} />
                <InfoRow icon={FiUser} label="Phụ huynh nộp đơn">
                  {data.parentName ?? "—"}
                  {data.parentRelationship && (
                    <span className="text-slate-400"> · {data.parentRelationship}</span>
                  )}
                  {data.parentPhone && (
                    <div className="text-xs font-normal text-slate-500">{data.parentPhone}</div>
                  )}
                </InfoRow>
                <div style={{ borderTop: "1px solid #FFF7F2" }} />
                <InfoRow icon={FiClock} label="Ngày nộp">
                  {formatDateVN(data.createdAt)}
                </InfoRow>
              </div>

              {/* Reason */}
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Lý do xin nghỉ
                </p>
                <div
                  className="rounded-xl px-4 py-3 text-sm text-slate-700"
                  style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}
                >
                  {data.reason || "Không có nội dung."}
                </div>
              </div>

              {/* Attachment */}
              {data.attachmentId && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Tài liệu đính kèm
                  </p>
                  <a
                    href={data.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition hover:bg-slate-50"
                    style={{ border: "1px solid #FFE7D6" }}
                  >
                    <FiPaperclip size={16} style={{ color: "#08509F" }} />
                    <span className="min-w-0 flex-1 truncate font-medium" style={{ color: "#08509F" }}>
                      {data.attachmentName ?? "Tệp đính kèm"}
                    </span>
                    <span className="text-xs text-slate-400">Mở</span>
                  </a>
                </div>
              )}

              {/* Approval history */}
              {data.approvalHistory && data.approvalHistory.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Lịch sử xử lý
                  </p>
                  <div className="space-y-2">
                    {data.approvalHistory.map((h) => {
                      const approved = h.action === "APPROVE";
                      return (
                        <div
                          key={h.approvalId}
                          className="flex gap-3 rounded-xl px-3 py-2.5"
                          style={{ backgroundColor: approved ? "#ECFDF5" : "#FEF2F2" }}
                        >
                          {approved ? (
                            <FiCheckCircle size={16} className="mt-0.5 shrink-0" style={{ color: "#16A34A" }} />
                          ) : (
                            <FiXCircle size={16} className="mt-0.5 shrink-0" style={{ color: "#DC2626" }} />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium" style={{ color: "#0F2747" }}>
                              {approved ? "Đã duyệt" : "Đã từ chối"}
                              <span className="ml-1 font-normal text-slate-400">
                                · {h.approverName}
                              </span>
                            </p>
                            {h.comment && (
                              <p className="text-xs text-slate-600">{h.comment}</p>
                            )}
                            <p className="mt-0.5 text-xs text-slate-400">{h.approvalTime}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions (only for PENDING) */}
        {!loading && !error && data && isPending && (
          <div className="flex gap-3 px-5 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
            <button
              type="button"
              onClick={() => onReject(data)}
              className="flex-1 rounded-full border-2 py-2.5 text-sm font-semibold transition hover:bg-red-50"
              style={{ borderColor: "#DC2626", color: "#DC2626" }}
            >
              Từ chối
            </button>
            <button
              type="button"
              onClick={() => onApprove(data)}
              className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
              style={{ backgroundColor: "#16A34A" }}
            >
              Duyệt đơn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaveRequestDetailDrawer;
