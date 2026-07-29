import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { parentApi } from "../../api/client";
import WelcomeBanner from "../../components/molecules/WelcomeBanner";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentNotifications } from "../../hooks/useParentNotifications";
import { useParentStudentAttendance } from "../../hooks/useParentStudentAttendance";
import { useParentStudentHomework } from "../../hooks/useParentStudentHomework";
import { useParentStudentEvents } from "../../hooks/useParentStudentEvents";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

// FSchool Parent Portal — Stitch design tokens (matches the teacher portal)
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
  errorContainer: "#FFDAD6",
  onErrorContainer: "#93000A",
  surface: "#F9F9F9",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};
const CARD = "bg-white rounded-4xl shadow-[0px_4px_12px_rgba(15,39,71,0.08)]";
const VI_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const NOTIF_TYPE_LABEL = {
  HOMEWORK: "Bài tập",
  ATTENDANCE: "Điểm danh",
  GRADE: "Bảng điểm",
  BEHAVIOUR: "Hạnh kiểm",
  EVENT: "Sự kiện",
  LEAVE: "Xin nghỉ",
  MEETING: "Cuộc họp",
  MESSAGE: "Tin nhắn",
  SYSTEM: "Hệ thống",
};

const NOTIF_ICON = {
  HOMEWORK: "assignment",
  ATTENDANCE: "how_to_reg",
  GRADE: "grade",
  BEHAVIOUR: "rule",
  EVENT: "local_activity",
  LEAVE: "event_busy",
  MEETING: "groups",
  MESSAGE: "chat",
  SYSTEM: "campaign",
};

const HW_STATUS = {
  GRADED: { label: "Đã chấm", color: "#16A34A" },
  SUBMITTED: { label: "Đã nộp", color: C.secondary },
  MISSING: { label: "Chưa nộp", color: C.primaryContainer },
  LATE: { label: "Nộp muộn", color: C.error },
};

function Ms({ name, className = "", style }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dueLabel(dueDate) {
  if (!dueDate) return { text: "", color: C.onSurfaceVariant };
  const due = new Date(String(dueDate).replace(" ", "T"));
  const days = Math.floor((due - new Date()) / 86400000);
  if (days < 0) return { text: `Trễ ${Math.abs(days)} ngày`, color: C.error };
  if (days === 0) return { text: "Hạn chót hôm nay", color: C.error };
  if (days === 1) return { text: "Hạn chót ngày mai", color: C.onSurfaceVariant };
  return { text: `Còn ${days} ngày`, color: C.onSurfaceVariant };
}

// ─── Weekly Attendance Bar Chart (Stitch: soft blue bars, solid highlight) ───

function ActivityBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex h-48 items-center justify-center rounded-4xl border border-dashed text-sm text-slate-400"
        style={{ borderColor: C.outlineVariant, backgroundColor: C.surface }}
      >
        Chưa có dữ liệu điểm danh tuần này
      </div>
    );
  }

  const rates = data.map((d) => {
    const attended = d.present + d.late;
    return d.total > 0 ? Math.round((attended / d.total) * 100) : 0;
  });
  const maxRate = Math.max(...rates, 1);

  return (
    <div className="flex h-48 items-end justify-between gap-2 px-2">
      {data.map((d, i) => {
        const dateObj = new Date(d.date + "T00:00:00");
        const label = VI_DAYS[dateObj.getDay()];
        const rate = rates[i];
        const hPct = Math.max(4, Math.round((rate / maxRate) * 95));
        const isTop = rate === maxRate && rate > 0;
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-2 self-stretch">
            <div className="flex w-full flex-1 items-end" title={`${label}: ${rate}% có mặt`}>
              <div
                className={`w-full transition-all ${
                  isTop
                    ? "bg-[#225DAD] hover:opacity-90"
                    : "rounded-t bg-[#225DAD]/20 hover:bg-[#225DAD]/40"
                }`}
                style={{ height: `${hPct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold" style={{ color: C.onSurfaceVariant }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function ParentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [parentProfile, setParentProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  const { students, loading: studentsLoading, error: studentsError } = useParentStudents();
  const { data: notifData, loading: notifLoading } = useParentNotifications({ limit: 5 });

  useEffect(() => {
    let isMounted = true;

    parentApi
      .getMyProfile()
      .then((response) => {
        if (isMounted) setParentProfile(response.data);
      })
      .catch((error) => {
        if (isMounted) setProfileError(error.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedStudentId || students.length === 0) return;
    const primary = students.find((s) => s.isPrimary === 1) || students[0];
    setSelectedStudentId(primary.studentId);
  }, [students, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.studentId === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );

  const headerUser = useMemo(() => {
    const parentRole = user?.roles?.find(
      (role) => role.roleName === "PARENT",
    );

    return {
      name:
        parentProfile?.fullName ||
        user?.fullName ||
        user?.username ||
        "Phụ huynh",

      role: parentRole?.description || "Phụ huynh",

      avatar: parentProfile?.avatar || user?.avatar || "",
    };
  }, [parentProfile, user]);

  // ── Last 7 days attendance for the selected child ──
  const { weekStart, weekEnd } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    return { weekStart: toISO(start), weekEnd: toISO(end) };
  }, []);

  const { data: attendanceHistory, loading: attendanceLoading } = useParentStudentAttendance(
    selectedStudentId,
    weekStart,
    weekEnd,
  );

  const weeklyAttendance = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(toISO(d));
    }
    const items = attendanceHistory?.items ?? [];
    return days.map((date) => {
      const dayItems = items.filter((it) => it.attendanceDate === date);
      return {
        date,
        total: dayItems.length,
        present: dayItems.filter((it) => it.typeName === "PRESENT").length,
        late: dayItems.filter((it) => it.typeName === "LATE").length,
      };
    });
  }, [attendanceHistory]);

  const weeklyRate = useMemo(() => {
    const totals = weeklyAttendance.reduce(
      (acc, d) => ({
        attended: acc.attended + d.present + d.late,
        total: acc.total + d.total,
      }),
      { attended: 0, total: 0 },
    );
    return totals.total > 0 ? Math.round((totals.attended / totals.total) * 100) : null;
  }, [weeklyAttendance]);

  const todayAtt = weeklyAttendance[weeklyAttendance.length - 1] ?? null;

  const todayStatus = useMemo(() => {
    if (!todayAtt || todayAtt.total === 0) {
      return { label: "Chưa điểm danh hôm nay", color: C.onSurfaceVariant, ms: "pending" };
    }
    if (todayAtt.present > 0) return { label: "Có mặt", color: "#16A34A", ms: "check_circle" };
    if (todayAtt.late > 0) return { label: "Đi muộn", color: C.primaryContainer, ms: "schedule" };
    return { label: "Vắng mặt", color: C.error, ms: "cancel" };
  }, [todayAtt]);

  // ── Pending homework for the selected child ──
  const { data: homeworkData, loading: homeworkLoading } = useParentStudentHomework(
    selectedStudentId,
    { status: "OPEN" },
    Boolean(selectedStudentId),
  );

  const pendingHomeworks = useMemo(() => {
    const items = homeworkData?.items ?? [];
    return items
      .filter((hw) => hw.submissionStatus !== "SUBMITTED" && hw.submissionStatus !== "GRADED")
      .slice()
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  }, [homeworkData]);

  // ── Upcoming events for the selected child ──
  const { data: eventsData } = useParentStudentEvents(selectedStudentId, { status: "ACTIVE" });

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const items = eventsData?.events ?? [];
    return items
      .filter((e) => e.startDate && new Date(e.startDate.replace(" ", "T")) >= now)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 3);
  }, [eventsData]);

  const unreadNotifications = notifData?.summary?.unreadNotifications ?? 0;

  const metricTiles = [
    { ms: "event_available", color: "#16A34A", label: "Chuyên cần", value: weeklyRate !== null ? `${weeklyRate}%` : "—" },
    { ms: "assignment_late", color: C.primaryContainer, label: "Bài chờ nộp", value: String(pendingHomeworks.length) },
    { ms: "local_activity", color: C.secondary, label: "Sự kiện sắp tới", value: String(upcomingEvents.length) },
    { ms: "notifications", color: C.primary, label: "Thông báo mới", value: String(unreadNotifications) },
  ];

  const quickActions = [
    { label: "Xem điểm danh", ms: "how_to_reg", to: "/parent/attendance" },
    { label: "Xin nghỉ phép", ms: "event_busy", to: "/parent/leave-requests" },
    { label: "Nhắn tin giáo viên", ms: "chat", to: "/parent/messages" },
  ];

  const activities = useMemo(() => {
    const items = notifData?.items ?? [];
    return items.slice(0, 4).map((n) => ({
      key: n.notificationId,
      ms: NOTIF_ICON[n.type] || "notifications",
      color: n.isRead ? C.onSurfaceVariant : C.primaryContainer,
      title: n.title,
      sub: NOTIF_TYPE_LABEL[n.type] || "Thông báo",
      time: n.createdAt,
    }));
  }, [notifData]);

  const sidebarFooterValue = studentsLoading
    ? "Đang tải..."
    : getCurrentSchoolYearLabel(students);

  const avColors = [C.primary, C.secondary, C.tertiary];

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={sidebarFooterValue}
    >
      <WelcomeBanner
        name={headerUser.name}
        message="Chúc bạn và gia đình một ngày tốt lành."
      />

      {profileError && (
        <div className="mb-6 rounded-4xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được hồ sơ phụ huynh: {profileError}
        </div>
      )}

      {!studentsLoading && !studentsError && students.length === 0 && (
        <div
          className="mb-6 rounded-4xl px-4 py-3 text-sm"
          style={{ border: `1px solid ${C.outlineVariant}`, backgroundColor: "#FFF7F2", color: C.onSurface }}
        >
          Chưa có học sinh nào được liên kết với tài khoản của bạn. Vui lòng liên hệ nhà trường.
        </div>
      )}

      {/* ── Welcome Header (Stitch) ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold" style={{ color: C.onSurface }}>
          Tổng quan phụ huynh
        </h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/parent/attendance")}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: C.deepBlue }}
          >
            <Ms name="how_to_reg" className="!text-[20px]!" />
            <span>Xem điểm danh</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/parent/leave-requests")}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: C.primaryContainer }}
          >
            <Ms name="event_busy" className="!text-[20px]!" />
            <span>Xin nghỉ phép</span>
          </button>
        </div>
      </div>

      {/* ── Student selector ── */}
      {!studentsLoading && students.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelectedStudentId(s.studentId)}
              className="rounded-full px-4 py-2 text-sm font-bold transition"
              style={
                s.studentId === selectedStudentId
                  ? { backgroundColor: C.deepBlue, color: "#fff" }
                  : { border: `1px solid ${C.outlineVariant}`, color: C.onSurface, backgroundColor: "#fff" }
              }
            >
              {s.studentFullName}
              {s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Main column (col 1-8) */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-8">
          {/* Weekly Attendance Chart */}
          <div className={`${CARD} p-6`}>
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>
                Chuyên cần trong tuần
                {selectedStudent ? ` · ${selectedStudent.studentFullName}` : ""}
              </h3>
              <div className="flex items-center gap-1 text-sm" style={{ color: C.onSurfaceVariant }}>
                <span>7 ngày qua</span>
              </div>
            </div>
            {attendanceLoading ? (
              <div className="h-48 animate-pulse rounded-4xl bg-slate-200/60" />
            ) : (
              <ActivityBarChart data={weeklyAttendance} />
            )}
          </div>

          {/* Integrated Key Metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {metricTiles.map((t) => (
              <div
                key={t.label}
                className="flex flex-col items-center rounded-4xl border bg-white p-4 text-center shadow-sm"
                style={{ borderColor: "rgba(223,192,178,0.3)" }}
              >
                <Ms name={t.ms} className="mb-1" style={{ color: t.color }} />
                <p className="text-[10px] font-bold uppercase tracking-tight" style={{ color: C.onSurfaceVariant }}>
                  {t.label}
                </p>
                <p className="mt-1 text-xl font-extrabold leading-none" style={{ color: C.onSurface }}>
                  {t.value}
                </p>
              </div>
            ))}
          </div>

          {/* My children */}
          <div className={`${CARD} p-6`}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>
                Học sinh của tôi
              </h3>
              <span className="text-sm" style={{ color: C.onSurfaceVariant }}>
                Chọn học sinh để xem chi tiết
              </span>
            </div>

            {studentsLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[0, 1].map((n) => (
                  <div key={n} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : studentsError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                Không tải được danh sách học sinh: {studentsError}
              </div>
            ) : students.length === 0 ? (
              <div
                className="flex h-32 items-center justify-center rounded-4xl border border-dashed text-sm text-slate-400"
                style={{ borderColor: C.outlineVariant, backgroundColor: C.surface }}
              >
                Chưa có học sinh nào được liên kết
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {students.map((s, idx) => {
                  const isSelected = s.studentId === selectedStudentId;
                  const avColor = avColors[idx % 3];
                  return (
                    <button
                      key={s.studentId}
                      type="button"
                      onClick={() => setSelectedStudentId(s.studentId)}
                      className="flex flex-col rounded-2xl p-4 text-left transition-colors"
                      style={{
                        border: isSelected ? `2px solid ${C.primaryContainer}` : `1px solid ${C.outlineVariant}40`,
                        backgroundColor: isSelected ? "#FFF7F2" : C.surface,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
                          style={{ backgroundColor: `${avColor}1A`, color: avColor }}
                        >
                          {s.studentAvatar ? (
                            <img src={s.studentAvatar} alt={s.studentFullName} className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            initials(s.studentFullName)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold" style={{ color: C.onSurface }}>
                            {s.studentFullName}
                          </p>
                          <p className="mb-0 text-xs" style={{ color: C.onSurfaceVariant }}>
                            {s.studentCode} · {s.relationship}
                          </p>
                          <p className="mb-0 text-xs font-medium" style={{ color: s.className ? C.secondary : "#94A3B8" }}>
                            {s.className ? `${s.className} · ${s.gradeName}` : "Chưa xếp lớp"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <a
                          href={`/parent/student/${s.studentId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-white"
                          style={{ borderColor: C.outlineVariant, color: C.onSurfaceVariant }}
                        >
                          <Ms name="person" className="!text-[14px]!" />
                          Hồ sơ
                        </a>
                        {s.classId && (
                          <a
                            href={`/parent/timetable?student=${s.studentId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                            style={{ backgroundColor: C.secondary }}
                          >
                            <Ms name="calendar_month" className="!text-[14px]!" />
                            TKB
                          </a>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Homework Pending + Today's Attendance */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Homework Pending */}
            <div className={`${CARD} p-6`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold" style={{ color: C.onSurface }}>
                  Bài tập chờ nộp
                </h3>
                <span
                  className="rounded px-2 py-1 text-[10px] font-bold"
                  style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.primaryContainer }}
                >
                  TỔNG CỘNG {pendingHomeworks.length}
                </span>
              </div>
              {homeworkLoading ? (
                <div className="space-y-3">
                  {[0, 1].map((n) => (
                    <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : pendingHomeworks.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Không có bài tập nào đang chờ nộp.
                </p>
              ) : (
                <div className="space-y-4">
                  {pendingHomeworks.slice(0, 2).map((hw) => {
                    const dl = dueLabel(hw.dueDate);
                    const status = HW_STATUS[hw.submissionStatus] || HW_STATUS.MISSING;
                    return (
                      <a
                        key={hw.homeworkId}
                        href="/parent/homework"
                        className="group block w-full rounded-xl border p-3 text-left transition-colors hover:border-[#9F4200]"
                        style={{ backgroundColor: C.surface, borderColor: C.outlineVariant }}
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <p className="text-sm font-bold" style={{ color: C.onSurface }}>
                            {hw.title}
                          </p>
                          <span className="shrink-0 text-[10px] font-bold" style={{ color: dl.color }}>
                            {dl.text}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
                            {hw.subjectName || ""}
                          </p>
                          <span className="text-[10px] font-bold" style={{ color: status.color }}>
                            {status.label}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Today's Attendance Widget */}
            <div className={`${CARD} p-6`}>
              <h3 className="mb-4 text-base font-bold" style={{ color: C.onSurface }}>
                Điểm danh hôm nay
              </h3>
              <div
                className="mb-4 flex items-center gap-4 rounded-4xl p-4"
                style={{ backgroundColor: "rgba(214,227,255,0.3)" }}
              >
                <Ms name={todayStatus.ms} className="!text-[32px]!" style={{ color: todayStatus.color }} />
                <div>
                  <p className="text-lg font-extrabold" style={{ color: todayStatus.color }}>
                    {todayStatus.label}
                  </p>
                  <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
                    {selectedStudent ? selectedStudent.studentFullName : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/parent/attendance")}
                className="w-full rounded-full border py-2 text-center text-sm font-bold transition-colors hover:text-[#00458E]"
                style={{ borderColor: C.secondary, color: C.secondary }}
              >
                Xem lịch sử điểm danh
              </button>
            </div>
          </div>
        </div>

        {/* Right column (col 9-12) */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          {/* Quick Actions */}
          <div className="rounded-4xl p-6 text-white shadow-md" style={{ backgroundColor: C.deepBlue }}>
            <h3 className="mb-4 text-base font-bold">Thao tác nhanh</h3>
            <div className="flex flex-col gap-2">
              {quickActions.map((a) => (
                <button
                  key={a.to}
                  type="button"
                  onClick={() => navigate(a.to)}
                  className="group flex items-center justify-between rounded-full bg-white/10 p-3 px-4 transition-all hover:bg-white/20"
                >
                  <span className="font-bold">{a.label}</span>
                  <Ms name={a.ms} className="transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className={CARD}>
            <div
              className="flex items-center justify-between p-6"
              style={{ borderBottom: `1px solid ${C.outlineVariant}` }}
            >
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>
                Sự kiện sắp tới
              </h3>
              <button
                type="button"
                onClick={() => navigate("/parent/events")}
                className="text-sm font-bold hover:underline"
                style={{ color: C.secondary }}
              >
                Tất cả
              </button>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Chưa có sự kiện nào sắp diễn ra.</p>
            ) : (
              <div>
                {upcomingEvents.map((e, i) => (
                  <button
                    key={e.eventId}
                    type="button"
                    onClick={() => navigate("/parent/events")}
                    className="flex w-full cursor-pointer gap-4 p-6 text-left transition-colors hover:bg-white"
                    style={i > 0 ? { borderTop: `1px solid ${C.outlineVariant}` } : undefined}
                  >
                    <div
                      className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border"
                      style={{ backgroundColor: C.surfaceHigh, borderColor: C.outlineVariant }}
                    >
                      <span className="text-[10px] font-bold uppercase" style={{ color: C.onSurfaceVariant }}>
                        THÁNG {Number(e.startDate?.slice(5, 7))}
                      </span>
                      <span className="text-xl font-extrabold" style={{ color: C.onSurface }}>
                        {e.startDate?.slice(8, 10)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold" style={{ color: C.onSurface }}>
                        {e.title}
                      </p>
                      <p className="text-sm" style={{ color: C.onSurfaceVariant }}>
                        {e.startDate?.slice(11, 16)}
                        {e.location ? ` - ${e.location}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Timeline */}
          <div className={`${CARD} flex-1 p-6`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>
                Hoạt động gần đây
              </h3>
              <button
                type="button"
                onClick={() => navigate("/parent/notifications")}
                className="text-sm font-bold hover:underline"
                style={{ color: C.secondary }}
              >
                Tất cả
              </button>
            </div>

            {notifLoading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((n) => (
                  <div key={n} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có hoạt động nào gần đây.</p>
            ) : (
              <div className="relative space-y-6 before:absolute before:bottom-2 before:left-2.75 before:top-2 before:w-0.5 before:bg-[#DFC0B2]">
                {activities.map((a) => (
                  <div key={a.key} className="relative pl-8">
                    <div
                      className="absolute left-0 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white"
                      style={{ borderColor: a.color }}
                    >
                      <Ms name={a.ms} className="!text-[12px]!" style={{ color: a.color }} />
                    </div>
                    <p className="line-clamp-1 text-sm font-bold" style={{ color: C.onSurface }}>
                      {a.title}
                    </p>
                    <p className="text-sm" style={{ color: C.onSurfaceVariant }}>
                      {a.sub}
                    </p>
                    <p className="text-[10px]" style={{ color: `${C.onSurfaceVariant}99` }}>
                      {a.time}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default ParentDashboard;
