import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiFile, FiX } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import Modal from "../../components/atoms/Modal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentLeaveRequests } from "../../hooks/useParentStudentLeaveRequests";
import { useParentStudentTimetable } from "../../hooks/useParentStudentTimetable";
import { parentApi } from "../../api/client";
import { formatLeaveDateRange, formatLeavePeriods } from "../../utils/leaveTime";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

// ─── FSchool Stitch design tokens (matches the teacher leave-request portal) ─

const C = {
  onSurface: "#1A1C1C",
  onSurfaceVariant: "#584238",
  outlineVariant: "#DFC0B2",
  primary: "#9F4200",
  primaryContainer: "#F27123",
  secondary: "#225DAD",
  deepBlue: "#00458E",
  tertiary: "#4A5F82",
  error: "#BA1A1A",
  surface: "#F9F9F9",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};

const CARD_SHADOW = "0px 4px 12px rgba(15, 39, 71, 0.08)";

function Ms({ name, className = "", style, fill = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}
    >
      {name}
    </span>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { key: "",          label: "Tất cả trạng thái" },
  { key: "PENDING",   label: "Chờ duyệt" },
  { key: "APPROVED",  label: "Đã duyệt"  },
  { key: "REJECTED",  label: "Từ chối"   },
  { key: "CANCELLED", label: "Đã hủy"    },
];

// The 3 types the create-form actually supports (backend enum)
const CREATABLE_LEAVE_TYPES = {
  SICK_LEAVE: "Nghỉ ốm",
  FAMILY_LEAVE: "Nghỉ việc gia đình",
  OTHER: "Khác",
};

const LEAVE_TYPE_LABEL = {
  SICK_LEAVE: "Nghỉ ốm",
  FAMILY: "Việc gia đình",
  FAMILY_LEAVE: "Việc gia đình",
  PERSONAL: "Việc cá nhân",
  PERSONAL_LEAVE: "Việc cá nhân",
  OTHER: "Khác",
};

const LEAVE_TYPE_META = {
  SICK_LEAVE: { icon: "medical_services", color: C.primary },
  FAMILY: { icon: "family_restroom", color: C.tertiary },
  FAMILY_LEAVE: { icon: "family_restroom", color: C.tertiary },
  PERSONAL: { icon: "assignment_turned_in", color: "#003C7C" },
  PERSONAL_LEAVE: { icon: "assignment_turned_in", color: "#003C7C" },
  OTHER: { icon: "description", color: C.onSurfaceVariant },
};

const STATUS_PILL = {
  PENDING: { label: "Chờ duyệt", bg: "rgba(242, 113, 35, 0.1)", text: "#9F4200" },
  APPROVED: { label: "Đã duyệt", bg: "rgba(34, 93, 173, 0.1)", text: "#225DAD" },
  REJECTED: { label: "Từ chối", bg: "rgba(186, 26, 26, 0.1)", text: "#BA1A1A" },
  CANCELLED: { label: "Đã hủy", bg: "rgba(88, 66, 56, 0.1)", text: C.onSurfaceVariant },
};

const SESSION_LABELS = { MORNING: "Buổi sáng", AFTERNOON: "Buổi chiều" };

const INPUT_CLS =
  "rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#00458E]";

function leaveTypeLabel(type) {
  if (!type) return "—";
  return LEAVE_TYPE_LABEL[type] ?? type;
}

function leaveTypeMeta(type) {
  return LEAVE_TYPE_META[type] ?? { icon: "description", color: C.onSurfaceVariant };
}

function tabCls(active) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition ${
    active
      ? "text-white"
      : "border bg-white hover:bg-slate-50"
  }`;
}

function tabStyle(active) {
  return active
    ? { backgroundColor: C.deepBlue, borderColor: C.deepBlue, color: "#fff" }
    : { borderColor: C.outlineVariant, color: C.onSurfaceVariant };
}

function StatusBadge({ status }) {
  const cfg = STATUS_PILL[status] ?? { label: status, bg: "#F1F5F9", text: "#475569" };
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi} ${dd}/${mm}/${yyyy}`;
}

function toDateInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getDefaultFullDayDate() {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(7, 30, 0, 0);

  const date = new Date(now);
  if (now >= cutoff) date.setDate(date.getDate() + 1);

  return toDateInputValue(date);
}

function getTodayDate() {
  return toDateInputValue(new Date());
}

function getCurrentTimeHHMM() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Nghỉ theo tiết: hôm nay vẫn chọn được miễn còn tiết chưa bắt đầu; chỉ nhảy
// sang ngày mai khi tiết cuối (16:45) cũng đã qua.
function getDefaultPartialDayDate() {
  const now = new Date();
  const lastPeriodEnd = new Date(now);
  lastPeriodEnd.setHours(16, 45, 0, 0);

  const date = new Date(now);
  if (now >= lastPeriodEnd) date.setDate(date.getDate() + 1);

  return toDateInputValue(date);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SummaryCard({ label, value, caption, iconName, accent, children }) {
  return (
    <div
      className="rounded-4xl bg-white p-6 transition-transform hover:-translate-y-0.5"
      style={{ borderLeft: `4px solid ${accent}`, boxShadow: CARD_SHADOW }}
    >
      <div className="mb-2 flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>
          {label}
        </p>
        <Ms name={iconName} style={{ color: accent }} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-bold leading-none tracking-tight" style={{ color: C.onSurface }}>
          {value}
        </span>
      </div>
      {caption && (
        <p className="mt-2 text-xs italic" style={{ color: C.onSurfaceVariant }}>
          {caption}
        </p>
      )}
      {children}
    </div>
  );
}

function AttachmentPicker({ file, onChange }) {
  const isImage = file && file.type.startsWith("image/");
  const previewUrl = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [isImage, file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>
        Tệp đính kèm (không bắt buộc) — ảnh hoặc PDF, tối đa 5MB
      </label>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="cursor-pointer text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#00458E] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:transition hover:file:opacity-90"
      />

      {file && (
        <div className="flex items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2" style={{ borderColor: C.outlineVariant }}>
          {previewUrl ? (
            <img src={previewUrl} alt={file.name} className="h-14 w-14 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: "rgba(242,113,35,0.15)", color: C.primary }}>
              <FiFile size={22} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: C.onSurface }}>{file.name}</p>
            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
          </div>

          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Bỏ tệp"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
          >
            <FiX size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function CreateLeaveRequestModal({ studentId, onClose, onCreated }) {
  const fullDayDefaultDate = useMemo(() => getDefaultFullDayDate(), []);
  const partialDayDefaultDate = useMemo(() => getDefaultPartialDayDate(), []);
  const todayDate = useMemo(() => getTodayDate(), []);

  const [durationMode, setDurationMode] = useState("MULTI_DAY");
  const [leaveType, setLeaveType] = useState("SICK_LEAVE");
  const [rangeStart, setRangeStart] = useState(fullDayDefaultDate);
  const [rangeEnd, setRangeEnd] = useState(fullDayDefaultDate);
  const [singleDate, setSingleDate] = useState(partialDayDefaultDate);
  const [session, setSession] = useState("MORNING");
  const [selectedPeriods, setSelectedPeriods] = useState([]);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { data: timetableData, loading: slotsLoading } = useParentStudentTimetable(
    durationMode === "PARTIAL_DAY" ? studentId : null,
  );

  const periodsInSession = useMemo(() => {
    const all = (timetableData?.slots ?? []).filter((s) => s.session === session);
    if (singleDate !== todayDate) return all;
    const nowTime = getCurrentTimeHHMM();
    return all.filter((s) => s.startTime > nowTime);
  }, [timetableData, session, singleDate, todayDate]);

  const allPeriodsSelected =
    periodsInSession.length > 0 && selectedPeriods.length === periodsInSession.length;

  function togglePeriod(periodNo) {
    setSelectedPeriods((prev) =>
      prev.includes(periodNo) ? prev.filter((p) => p !== periodNo) : [...prev, periodNo].sort((a, b) => a - b),
    );
  }

  function handleSessionChange(value) {
    setSession(value);
    setSelectedPeriods([]);
  }

  function handleToggleAllPeriods() {
    setSelectedPeriods(allPeriodsSelected ? [] : periodsInSession.map((s) => s.periodNo));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!reason.trim()) {
      setError("Vui lòng nhập lý do xin nghỉ");
      return;
    }

    let startDateTime;
    let endDateTime;

    if (durationMode === "MULTI_DAY") {
      if (!rangeStart || !rangeEnd) {
        setError("Vui lòng chọn thời gian nghỉ");
        return;
      }
      if (rangeStart < fullDayDefaultDate) {
        setError("Không thể chọn ngày trong quá khứ");
        return;
      }
      if (rangeEnd < rangeStart) {
        setError("Ngày kết thúc không thể trước ngày bắt đầu");
        return;
      }
      startDateTime = `${rangeStart}T07:30`;
      endDateTime = `${rangeEnd}T16:45`;
    } else {
      if (!singleDate) {
        setError("Vui lòng chọn ngày nghỉ");
        return;
      }
      if (singleDate < todayDate) {
        setError("Không thể chọn ngày trong quá khứ");
        return;
      }
      if (selectedPeriods.length === 0) {
        setError("Vui lòng chọn ít nhất một tiết nghỉ");
        return;
      }
      const chosen = periodsInSession.filter((s) => selectedPeriods.includes(s.periodNo));
      startDateTime = `${singleDate}T${chosen[0].startTime}`;
      endDateTime = `${singleDate}T${chosen[chosen.length - 1].endTime}`;
    }

    setSubmitting(true);
    setError("");

    const formData = new FormData();
    formData.append("leaveType", leaveType);
    formData.append("startDate", startDateTime);
    formData.append("endDate", endDateTime);
    formData.append("reason", reason.trim());
    if (file) formData.append("attachment", file);

    try {
      await parentApi.createLeaveRequest(studentId, formData);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Tạo đơn xin nghỉ" onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Loại đơn</label>
          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className={INPUT_CLS} style={{ borderColor: C.outlineVariant, color: C.onSurface }}>
            {Object.entries(CREATABLE_LEAVE_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Thời gian nghỉ</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDurationMode("MULTI_DAY")} className={tabCls(durationMode === "MULTI_DAY")} style={tabStyle(durationMode === "MULTI_DAY")}>
              Từ 1 ngày trở lên
            </button>
            <button type="button" onClick={() => setDurationMode("PARTIAL_DAY")} className={tabCls(durationMode === "PARTIAL_DAY")} style={tabStyle(durationMode === "PARTIAL_DAY")}>
              Một vài tiết trong ngày
            </button>
          </div>
        </div>

        {durationMode === "MULTI_DAY" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Từ ngày</label>
              <input type="date" value={rangeStart} min={fullDayDefaultDate} onChange={(e) => setRangeStart(e.target.value)} className={INPUT_CLS} style={{ borderColor: C.outlineVariant, color: C.onSurface }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Đến ngày</label>
              <input type="date" value={rangeEnd} min={rangeStart > fullDayDefaultDate ? rangeStart : fullDayDefaultDate} onChange={(e) => setRangeEnd(e.target.value)} className={INPUT_CLS} style={{ borderColor: C.outlineVariant, color: C.onSurface }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Ngày nghỉ</label>
              <input
                type="date"
                value={singleDate}
                min={todayDate}
                onChange={(e) => { setSingleDate(e.target.value); setSelectedPeriods([]); }}
                className={INPUT_CLS}
                style={{ borderColor: C.outlineVariant, color: C.onSurface }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Buổi</label>
              <div className="flex gap-2">
                {Object.entries(SESSION_LABELS).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => handleSessionChange(value)} className={tabCls(session === value)} style={tabStyle(session === value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Tiết nghỉ</label>
                <button
                  type="button"
                  onClick={handleToggleAllPeriods}
                  disabled={periodsInSession.length === 0}
                  className="rounded-full px-3 py-1 text-xs font-bold transition disabled:opacity-60"
                  style={{ backgroundColor: "rgba(242,113,35,0.15)", color: C.primary }}
                >
                  {allPeriodsSelected ? "Bỏ chọn cả buổi" : "Chọn cả buổi"}
                </button>
              </div>

              {slotsLoading ? (
                <p className="text-sm text-slate-400">Đang tải khung giờ học...</p>
              ) : periodsInSession.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {singleDate === todayDate
                    ? "Tất cả các tiết trong buổi này hôm nay đã bắt đầu. Vui lòng chọn buổi khác hoặc ngày khác."
                    : "Buổi này chưa có tiết học."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {periodsInSession.map((slot) => {
                    const active = selectedPeriods.includes(slot.periodNo);
                    return (
                      <button
                        key={slot.periodNo}
                        type="button"
                        onClick={() => togglePeriod(slot.periodNo)}
                        className="rounded-lg border px-3 py-2 text-xs font-medium transition"
                        style={active ? { borderColor: C.deepBlue, backgroundColor: C.deepBlue, color: "#fff" } : { borderColor: C.outlineVariant, color: C.onSurfaceVariant }}
                      >
                        <span className="block font-semibold">Tiết {slot.periodNo}</span>
                        <span className="block opacity-80">{slot.startTime}–{slot.endTime}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Lý do</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Nhập lý do xin nghỉ..." className={INPUT_CLS} style={{ borderColor: C.outlineVariant, color: C.onSurface }} />
        </div>

        <AttachmentPicker file={file} onChange={setFile} />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-slate-50" style={{ borderColor: C.outlineVariant, color: C.onSurfaceVariant }}>
            Hủy
          </button>
          <button type="submit" disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: C.deepBlue }}>
            {submitting ? "Đang gửi..." : "Gửi đơn"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Detail modal (parent-only: view + cancel, mirrors teacher's read side) ──

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <span style={{ color: C.onSurfaceVariant }}>{label}</span>
      <span className="col-span-2 font-medium" style={{ color: C.onSurface }}>{children}</span>
    </div>
  );
}

function LeaveRequestDetailModal({ leaveRequest, onClose, onCancelled }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    setCancelling(true);
    setError("");
    try {
      await onCancelled(leaveRequest);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  const typeMeta = leaveTypeMeta(leaveRequest.leaveType);
  return (
    <Modal open title="Chi tiết đơn xin nghỉ" onClose={onClose} maxWidth="max-w-xl">
      <div className="flex flex-col gap-1">
        <DetailRow label="Loại đơn">
          <span className="flex items-center gap-1.5">
            <Ms name={typeMeta.icon} className="!text-[16px]!" style={{ color: typeMeta.color }} />
            {leaveTypeLabel(leaveRequest.leaveType)}
          </span>
        </DetailRow>
        <DetailRow label="Thời gian nghỉ">
          {formatLeaveDateRange(leaveRequest.startDate, leaveRequest.endDate)}
          {formatLeavePeriods(leaveRequest.startDate, leaveRequest.endDate) && (
            <span className="ml-1 text-xs" style={{ color: C.onSurfaceVariant }}>
              ({formatLeavePeriods(leaveRequest.startDate, leaveRequest.endDate)})
            </span>
          )}
        </DetailRow>
        <DetailRow label="Lý do">{leaveRequest.reason}</DetailRow>
        <DetailRow label="GVCN duyệt">{leaveRequest.homeroomTeacherName ?? "—"}</DetailRow>
        <DetailRow label="Trạng thái">
          <StatusBadge status={leaveRequest.status} />
        </DetailRow>
        <DetailRow label="Ngày gửi">{formatDateTime(leaveRequest.createdAt)}</DetailRow>
        <DetailRow label="Tệp đính kèm">
          {leaveRequest.attachmentFileUrl ? (
            <a href={leaveRequest.attachmentFileUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: C.secondary }}>
              {leaveRequest.attachmentFileName ?? "Xem tệp"}
            </a>
          ) : (
            "—"
          )}
        </DetailRow>

        {leaveRequest.approvals?.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>
              Lịch sử duyệt
            </p>
            <div className="flex flex-col gap-2">
              {leaveRequest.approvals.map((a) => (
                <div key={a.approvalId} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: C.surfaceLow }}>
                  <span className="font-semibold" style={{ color: C.onSurface }}>{a.approverName}</span>
                  <span className="ml-1" style={{ color: C.onSurfaceVariant }}>
                    {a.action === "APPROVE" ? "đã duyệt" : "đã từ chối"} · {formatDateTime(a.approvalTime)}
                  </span>
                  {a.comment && <p className="mt-1" style={{ color: C.onSurface }}>{a.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          {leaveRequest.status === "PENDING" && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {cancelling ? "Đang hủy..." : "Hủy đơn"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: C.deepBlue }}>
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABLE_COLS = [
  { label: "Loại đơn", align: "text-left" },
  { label: "Thời gian nghỉ", align: "text-left" },
  { label: "Lý do", align: "text-left" },
  { label: "GVCN", align: "text-left" },
  { label: "Trạng thái", align: "text-center" },
  { label: "Thao tác", align: "text-right" },
];

function ParentStudentLeaveRequests() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { students, loading: studentsLoading } = useParentStudents();

  const paramStudentId = searchParams.get("student")
    ? parseInt(searchParams.get("student"), 10)
    : null;

  const activeStudentId = useMemo(() => {
    if (studentsLoading || students.length === 0) return null;
    if (paramStudentId && students.some((s) => s.studentId === paramStudentId))
      return paramStudentId;
    return students[0].studentId;
  }, [students, studentsLoading, paramStudentId]);

  const activeStudent = useMemo(
    () => students.find((s) => s.studentId === activeStudentId) ?? null,
    [students, activeStudentId],
  );

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const hookParams = useMemo(() => ({ status: statusFilter || undefined }), [statusFilter]);
  const { data, loading, error, refetch } = useParentStudentLeaveRequests(activeStudentId, hookParams);
  const items = data?.items ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      if (startDate && String(row.startDate).slice(0, 10) < startDate) return false;
      if (endDate && String(row.startDate).slice(0, 10) > endDate) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const hay = `${row.reason ?? ""} ${leaveTypeLabel(row.leaveType)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, startDate, endDate, searchTerm]);

  const counts = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
    for (const row of items) if (c[row.status] !== undefined) c[row.status] += 1;
    return c;
  }, [items]);

  const totalRequests = items.length;
  const processedRate = totalRequests > 0
    ? Math.round(((counts.APPROVED + counts.REJECTED + counts.CANCELLED) / totalRequests) * 100)
    : 0;
  const pad2 = (n) => String(n ?? 0).padStart(2, "0");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);

  function selectStudent(id) {
    setSearchParams({ student: id });
  }

  function clearFilters() {
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setSearchInput("");
    setSearchTerm("");
  }

  function submitSearch(e) {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
  }

  async function handleViewDetail(leaveRequestId) {
    try {
      const res = await parentApi.getLeaveRequestDetail(activeStudentId, leaveRequestId);
      setSelectedLeaveRequest(res.data);
    } catch {
      // Detail fetch failure surfaces via an empty modal close; list stays usable.
    }
  }

  async function handleCancelled(leaveRequest) {
    await parentApi.cancelLeaveRequest(activeStudentId, leaveRequest.leaveRequestId);
    setSelectedLeaveRequest(null);
    refetch();
  }

  const headerUser = useMemo(() => {
    const role = user?.roles?.find((r) => r.roleName === "PARENT");
    return {
      name: user?.fullName ?? user?.username ?? "Phụ huynh",
      role: role?.description ?? "Phụ huynh",
      avatar: user?.avatar ?? "",
    };
  }, [user]);

  const summaryCards = [
    { label: "ĐƠN ĐANG CHỜ", value: pad2(counts.PENDING), caption: "Đang chờ GVCN duyệt", iconName: "hourglass_empty", accent: C.primaryContainer },
    { label: "ĐÃ DUYỆT", value: pad2(counts.APPROVED), caption: null, iconName: "fact_check", accent: C.secondary },
    { label: "TỪ CHỐI", value: pad2(counts.REJECTED), caption: null, iconName: "cancel", accent: C.error },
  ];

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      <div className="flex flex-col gap-6">
        {/* Student selector — only when parent has multiple children */}
        {!studentsLoading && students.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {students.map((s) => (
              <button
                key={s.studentId}
                type="button"
                onClick={() => selectStudent(s.studentId)}
                className="rounded-xl px-4 py-2 text-sm font-medium transition"
                style={
                  s.studentId === activeStudentId
                    ? { backgroundColor: C.deepBlue, color: "#fff" }
                    : { border: `1px solid ${C.outlineVariant}`, backgroundColor: "#fff", color: C.onSurfaceVariant }
                }
              >
                {s.studentFullName}
                {s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Header section (Stitch) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold" style={{ color: C.onSurface }}>
            Đơn xin nghỉ{activeStudent ? ` · ${activeStudent.studentFullName}` : ""}
          </h2>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={!activeStudentId}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: C.primaryContainer }}
          >
            <Ms name="add_circle" className="!text-[18px]!" /> Tạo đơn xin nghỉ
          </button>
        </div>

        {/* Summary bento grid (Stitch) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
          <SummaryCard
            label="TỔNG SỐ ĐƠN"
            value={pad2(totalRequests)}
            caption={`Tỷ lệ đã xử lý ${processedRate}%`}
            iconName="event_busy"
            accent={C.deepBlue}
          >
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceHigh }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${processedRate}%`, backgroundColor: C.tertiary }} />
            </div>
          </SummaryCard>
        </div>

        {/* Filters card (Stitch) */}
        <div className="flex flex-wrap items-center gap-4 rounded-4xl bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ backgroundColor: "#EEEEEE" }}>
            <Ms name="filter_list" className="!text-[18px]!" style={{ color: C.onSurfaceVariant }} />
            <span className="text-xs font-bold" style={{ color: C.onSurface }}>Bộ lọc:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="cursor-pointer rounded-full border bg-white px-4 py-2 text-sm outline-none focus:ring-1"
            style={{ borderColor: C.outlineVariant, color: C.onSurface }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              title="Từ ngày"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-full border bg-white px-4 py-2 text-sm outline-none focus:ring-1"
              style={{ borderColor: C.outlineVariant, color: C.onSurface }}
            />
            <span className="text-sm" style={{ color: C.onSurfaceVariant }}>–</span>
            <input
              type="date"
              title="Đến ngày"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-full border bg-white px-4 py-2 text-sm outline-none focus:ring-1"
              style={{ borderColor: C.outlineVariant, color: C.onSurface }}
            />
          </div>

          <form onSubmit={submitSearch} className="flex items-center overflow-hidden rounded-full border bg-white pl-4" style={{ borderColor: C.outlineVariant }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo lý do..."
              className="w-44 border-none bg-transparent py-2 text-sm outline-none"
              style={{ color: C.onSurface }}
            />
            <button type="submit" title="Tìm kiếm" className="flex items-center rounded-full px-3 py-2 transition-colors hover:bg-[#EEEEEE]" style={{ color: C.onSurfaceVariant }}>
              <Ms name="search" className="!text-[18px]!" />
            </button>
          </form>

          <button type="button" onClick={clearFilters} className="ml-auto text-xs font-bold hover:underline" style={{ color: C.primary }}>
            Xóa tất cả
          </button>
        </div>

        {error && (
          <div className="rounded-4xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((n) => <div key={n} className="h-14 animate-pulse rounded-4xl bg-slate-200/60" />)}
          </div>
        )}

        {/* Requests table (Stitch) */}
        {!loading && !error && (
          <div className="overflow-hidden rounded-4xl border bg-white" style={{ borderColor: C.outlineVariant, boxShadow: CARD_SHADOW }}>
            {filteredItems.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-400">
                {items.length === 0 ? "Chưa có đơn xin nghỉ nào." : "Không có đơn nào phù hợp với bộ lọc."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                    <tr>
                      {TABLE_COLS.map((col) => (
                        <th key={col.label} className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${col.align}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: C.outlineVariant }}>
                    {filteredItems.map((row) => {
                      const typeMeta = leaveTypeMeta(row.leaveType);
                      const periods = formatLeavePeriods(row.startDate, row.endDate);
                      return (
                        <tr
                          key={row.leaveRequestId}
                          onClick={() => handleViewDetail(row.leaveRequestId)}
                          className="group cursor-pointer transition-colors hover:bg-[#F3F3F3]"
                        >
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-1.5 text-sm" style={{ color: C.onSurface }}>
                              <Ms name={typeMeta.icon} className="!text-[16px]!" style={{ color: typeMeta.color }} />
                              {leaveTypeLabel(row.leaveType)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <p className="text-sm font-medium" style={{ color: C.onSurface }}>
                              {formatLeaveDateRange(row.startDate, row.endDate)}
                            </p>
                            {periods && <p className="text-xs" style={{ color: C.onSurfaceVariant }}>{periods}</p>}
                          </td>
                          <td className="max-w-xs truncate px-6 py-4 text-sm" style={{ color: C.onSurfaceVariant }} title={row.reason}>
                            {row.reason}
                          </td>
                          <td className="px-6 py-4 text-sm" style={{ color: C.onSurfaceVariant }}>
                            {row.homeroomTeacherName ?? "—"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {row.status === "PENDING" && (
                                <button
                                  type="button"
                                  title="Hủy đơn"
                                  onClick={(e) => { e.stopPropagation(); handleCancelled(row); }}
                                  className="rounded-full p-2 transition-colors hover:bg-[#BA1A1A]/10"
                                  style={{ color: C.error }}
                                >
                                  <Ms name="cancel" />
                                </button>
                              )}
                              <button
                                type="button"
                                title="Xem chi tiết"
                                onClick={(e) => { e.stopPropagation(); handleViewDetail(row.leaveRequestId); }}
                                className="rounded-full p-2 transition-colors hover:bg-[#EEEEEE]"
                                style={{ color: C.onSurfaceVariant }}
                              >
                                <Ms name="visibility" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateLeaveRequestModal studentId={activeStudentId} onClose={() => setShowCreateModal(false)} onCreated={refetch} />
      )}

      {selectedLeaveRequest && (
        <LeaveRequestDetailModal
          leaveRequest={selectedLeaveRequest}
          onClose={() => setSelectedLeaveRequest(null)}
          onCancelled={handleCancelled}
        />
      )}
    </DashboardShell>
  );
}

export default ParentStudentLeaveRequests;