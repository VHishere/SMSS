import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiFile, FiPlus, FiX } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import Modal from "../../components/atoms/Modal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentLeaveRequests } from "../../hooks/useParentStudentLeaveRequests";
import { useParentStudentTimetable } from "../../hooks/useParentStudentTimetable";
import { parentApi } from "../../api/client";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

const LEAVE_TYPE_LABELS = {
  SICK_LEAVE: "Nghỉ ốm",
  FAMILY_LEAVE: "Nghỉ việc gia đình",
  OTHER: "Khác",
};

const STATUS_CONFIG = {
  PENDING: { label: "Chờ duyệt", cls: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Đã duyệt", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "Đã từ chối", cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Đã hủy", cls: "bg-gray-100 text-gray-600" },
};

const SESSION_LABELS = { MORNING: "Buổi sáng", AFTERNOON: "Buổi chiều" };

const INPUT_CLS =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

function tabCls(active) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition ${
    active
      ? "bg-[#08509F] text-white"
      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
  }`;
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${config.cls}`}>
      {config.label}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
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
      <label className="text-xs font-medium text-slate-500">
        Tệp đính kèm (không bắt buộc) — ảnh hoặc PDF, tối đa 5MB
      </label>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="
          cursor-pointer text-sm text-slate-500
          file:mr-3 file:cursor-pointer file:rounded-lg file:border-0
          file:bg-[#08509F] file:px-4 file:py-2 file:text-sm file:font-semibold
          file:text-white file:transition hover:file:bg-[#063e7c]
        "
      />

      {file && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={file.name}
              className="h-14 w-14 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#FFE7D6] text-[#C94F00]">
              <FiFile size={22} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#0F2747]">{file.name}</p>
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
      prev.includes(periodNo)
        ? prev.filter((p) => p !== periodNo)
        : [...prev, periodNo].sort((a, b) => a - b),
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
          <label className="text-xs font-medium text-slate-500">Loại đơn</label>
          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className={INPUT_CLS}>
            {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Thời gian nghỉ</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDurationMode("MULTI_DAY")}
              className={tabCls(durationMode === "MULTI_DAY")}
            >
              Từ 1 ngày trở lên
            </button>
            <button
              type="button"
              onClick={() => setDurationMode("PARTIAL_DAY")}
              className={tabCls(durationMode === "PARTIAL_DAY")}
            >
              Một vài tiết trong ngày
            </button>
          </div>
        </div>

        {durationMode === "MULTI_DAY" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Từ ngày</label>
              <input
                type="date"
                value={rangeStart}
                min={fullDayDefaultDate}
                onChange={(e) => setRangeStart(e.target.value)}
                className={INPUT_CLS}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Đến ngày</label>
              <input
                type="date"
                value={rangeEnd}
                min={rangeStart > fullDayDefaultDate ? rangeStart : fullDayDefaultDate}
                onChange={(e) => setRangeEnd(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Ngày nghỉ</label>
              <input
                type="date"
                value={singleDate}
                min={todayDate}
                onChange={(e) => {
                  setSingleDate(e.target.value);
                  setSelectedPeriods([]);
                }}
                className={INPUT_CLS}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Buổi</label>
              <div className="flex gap-2">
                {Object.entries(SESSION_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleSessionChange(value)}
                    className={tabCls(session === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">Tiết nghỉ</label>
                <button
                  type="button"
                  onClick={handleToggleAllPeriods}
                  disabled={periodsInSession.length === 0}
                  className="rounded-full bg-[#FFE7D6] px-3 py-1 text-xs font-bold text-[#C94F00] transition hover:bg-[#ffd9bd] disabled:opacity-60"
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
                  {periodsInSession.map((slot) => (
                    <button
                      key={slot.periodNo}
                      type="button"
                      onClick={() => togglePeriod(slot.periodNo)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        selectedPeriods.includes(slot.periodNo)
                          ? "border-[#08509F] bg-[#08509F] text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block font-semibold">Tiết {slot.periodNo}</span>
                      <span className="block opacity-80">
                        {slot.startTime}–{slot.endTime}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Lý do</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Nhập lý do xin nghỉ..."
            className={INPUT_CLS}
          />
        </div>

        <AttachmentPicker file={file} onChange={setFile} />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#08509F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#063e7c] disabled:opacity-60"
          >
            {submitting ? "Đang gửi..." : "Gửi đơn"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="col-span-2 font-medium text-[#0F2747]">{children}</span>
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

  return (
    <Modal open title="Chi tiết đơn xin nghỉ" onClose={onClose} maxWidth="max-w-xl">
      <div className="flex flex-col gap-1">
        <DetailRow label="Loại đơn">
          {LEAVE_TYPE_LABELS[leaveRequest.leaveType] ?? leaveRequest.leaveType}
        </DetailRow>
        <DetailRow label="Thời gian nghỉ">
          {formatDateTime(leaveRequest.startDate)} – {formatDateTime(leaveRequest.endDate)}
        </DetailRow>
        <DetailRow label="Lý do">{leaveRequest.reason}</DetailRow>
        <DetailRow label="GVCN duyệt">{leaveRequest.homeroomTeacherName ?? "—"}</DetailRow>
        <DetailRow label="Trạng thái">
          <StatusBadge status={leaveRequest.status} />
        </DetailRow>
        <DetailRow label="Ngày gửi">{formatDateTime(leaveRequest.createdAt)}</DetailRow>
        <DetailRow label="Tệp đính kèm">
          {leaveRequest.attachmentFileUrl ? (
            <a
              href={leaveRequest.attachmentFileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#08509F] underline"
            >
              {leaveRequest.attachmentFileName ?? "Xem tệp"}
            </a>
          ) : (
            "—"
          )}
        </DetailRow>

        {leaveRequest.approvals?.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lịch sử duyệt
            </p>
            <div className="flex flex-col gap-2">
              {leaveRequest.approvals.map((a) => (
                <div key={a.approvalId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-[#0F2747]">{a.approverName}</span>
                  <span className="ml-1 text-slate-500">
                    {a.action === "APPROVE" ? "đã duyệt" : "đã từ chối"} · {formatDateTime(a.approvalTime)}
                  </span>
                  {a.comment && <p className="mt-1 text-slate-600">{a.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#08509F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#063e7c]"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}

const TABLE_COLS = ["STT", "LOẠI ĐƠN", "THỜI GIAN NGHỈ", "LÝ DO", "GVCN", "TRẠNG THÁI", ""];
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

  const { data, loading, error, refetch } = useParentStudentLeaveRequests(activeStudentId);
  const items = data?.items ?? [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);

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

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {!studentsLoading && students.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSearchParams({ student: s.studentId })}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                s.studentId === activeStudentId
                  ? "bg-[#08509F] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.studentFullName}
              {s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#0F2747]">
          Danh sách đơn{activeStudent ? ` của ${activeStudent.studentFullName}` : ""}
        </h2>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={!activeStudentId}
          className="flex items-center gap-2 rounded-lg bg-[#F27123] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d95f15] disabled:opacity-60"
        >
          <FiPlus size={16} />
          Thêm đơn
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải danh sách đơn xin nghỉ...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Không tải được dữ liệu: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Chưa có đơn xin nghỉ nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-orange-100 bg-[#FFF7F2]">
                    {TABLE_COLS.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#F27123]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr
                      key={row.leaveRequestId}
                      className={`border-b border-slate-50 ${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"}`}
                    >
                      <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-[#0F2747]">
                        {LEAVE_TYPE_LABELS[row.leaveType] ?? row.leaveType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(row.startDate)} – {formatDateTime(row.endDate)}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={row.reason}>
                        {row.reason}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.homeroomTeacherName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleViewDetail(row.leaveRequestId)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#08509F] transition hover:bg-slate-50"
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateLeaveRequestModal
          studentId={activeStudentId}
          onClose={() => setShowCreateModal(false)}
          onCreated={refetch}
        />
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