import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useTeacherDashboard } from "../../hooks/useTeacherDashboard";
import { eventApi, homeworkApi } from "../../api/client";

// FSchool Teacher Portal — Stitch design tokens
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
const CARD = "bg-white rounded-[2rem] shadow-[0px_4px_12px_rgba(15,39,71,0.08)]";
const VI_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

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

function dueLabel(dueDate) {
  if (!dueDate) return { text: "", color: C.onSurfaceVariant };
  const due = new Date(String(dueDate).replace(" ", "T"));
  const days = Math.floor((due - new Date()) / 86400000);
  if (days < 0) return { text: `Trễ ${Math.abs(days)} ngày`, color: C.error };
  if (days === 0) return { text: "Hạn chót hôm nay", color: C.error };
  if (days === 1) return { text: "Hạn chót ngày mai", color: C.onSurfaceVariant };
  return { text: `Còn ${days} ngày`, color: C.onSurfaceVariant };
}

// ─── Weekly Activity Bar Chart (Stitch: soft blue bars, solid highlight) ─────

function ActivityBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex h-48 items-center justify-center rounded-[2rem] border border-dashed text-sm text-slate-400"
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

function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error } = useTeacherDashboard();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [homeworks, setHomeworks] = useState([]);

  useEffect(() => {
    let m = true;
    eventApi
      .list({ status: "ACTIVE", limit: 50 })
      .then((res) => {
        if (!m) return;
        const now = new Date();
        const items = (res.data.items ?? [])
          .filter((e) => e.startDate && new Date(e.startDate.replace(" ", "T")) >= now)
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .slice(0, 3);
        setUpcomingEvents(items);
      })
      .catch(() => {});
    homeworkApi
      .list({ status: "OPEN", limit: 50 })
      .then((res) => {
        if (!m) return;
        const items = (res.data.items ?? [])
          .slice()
          .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
        setHomeworks(items);
      })
      .catch(() => {});
    return () => {
      m = false;
    };
  }, []);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName),
    );
    return {
      name: data?.teacher?.fullName || user?.fullName || user?.username || "Giáo viên",
      role: roleEntry?.description || "Giáo viên",
      avatar: data?.teacher?.avatar || user?.avatar || "",
    };
  }, [data, user]);

  const primaryClass = data?.primaryClass ?? null;
  const todayAtt = data?.todayAttendance ?? null;
  const atRisk = data?.atRiskStudents ?? [];
  const engagement = data?.parentEngagement ?? null;

  const weeklyRate = useMemo(() => {
    if (!data?.weeklyAttendance?.length) return null;
    const totals = data.weeklyAttendance.reduce(
      (acc, d) => ({
        attended: acc.attended + d.present + d.late,
        total: acc.total + d.total,
      }),
      { attended: 0, total: 0 },
    );
    return totals.total > 0 ? Math.round((totals.attended / totals.total) * 100) : null;
  }, [data]);

  const pendingSubmissions = useMemo(
    () =>
      homeworks.reduce(
        (sum, hw) => sum + Math.max(0, (hw.totalStudents ?? 0) - (hw.totalSubmissions ?? 0)),
        0,
      ),
    [homeworks],
  );

  const avgAbsenceRate = useMemo(() => {
    if (!atRisk.length) return 0;
    return Math.round(atRisk.reduce((s, x) => s + (x.absenceRate ?? 0), 0) / atRisk.length);
  }, [atRisk]);

  const todayAbsent =
    todayAtt && todayAtt.total > 0 ? todayAtt.total - todayAtt.present : null;

  const sidebarFooterValue = loading
    ? "Đang tải..."
    : primaryClass?.className ?? "Chưa phân công";

  const metricTiles = [
    { ms: "group", color: C.secondary, label: "Học sinh", value: todayAtt?.total > 0 ? String(todayAtt.total) : "—" },
    { ms: "grade", color: C.primary, label: "Điểm TB", value: "—" },
    { ms: "event_available", color: "#16A34A", label: "Chuyên cần", value: weeklyRate !== null ? `${weeklyRate}%` : "—" },
    { ms: "assignment_late", color: C.primaryContainer, label: "Chờ nộp", value: String(pendingSubmissions) },
  ];

  const quickActions = [
    { label: "Gửi thông báo", ms: "campaign", to: "/teacher/announcements" },
    { label: "Nhập điểm số", ms: "edit_note", to: "/teacher/academic" },
    { label: "Liên hệ nhân viên", ms: "chat", to: "/teacher/messages" },
  ];

  const riskBars = [
    { label: "Điểm số thấp", value: 0, color: C.primary },
    { label: "Vắng học", value: avgAbsenceRate, color: C.secondary },
    { label: "Hành vi/Kỷ luật", value: 0, color: C.tertiary },
  ];

  const activities = [
    todayAtt && todayAtt.total > 0
      ? { ms: "check_circle", color: C.primary, title: "Đã điểm danh hôm nay", sub: `${todayAtt.present}/${todayAtt.total} học sinh có mặt`, time: "Hôm nay" }
      : { ms: "pending", color: C.primary, title: "Chưa điểm danh hôm nay", sub: primaryClass ? `Lớp ${primaryClass.className}` : "", time: "Hôm nay" },
    homeworks[0]
      ? { ms: "description", color: C.secondary, title: "Bài tập gần hạn", sub: homeworks[0].title, time: dueLabel(homeworks[0].dueDate).text }
      : null,
    engagement && engagement.readRate !== null
      ? { ms: "campaign", color: C.tertiary, title: "Thông báo phụ huynh", sub: `${engagement.totalRead}/${engagement.total} đã đọc`, time: "30 ngày qua" }
      : null,
  ].filter(Boolean);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Lớp chủ nhiệm"
      sidebarFooterValue={sidebarFooterValue}
    >
      {error && (
        <div className="mb-6 rounded-[2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được dữ liệu: {error}
        </div>
      )}

      {!loading && !error && !primaryClass && (
        <div
          className="mb-6 rounded-[2rem] px-4 py-3 text-sm"
          style={{ border: `1px solid ${C.outlineVariant}`, backgroundColor: "#FFF7F2", color: C.onSurface }}
        >
          Tài khoản chưa được phân công lớp học. Vui lòng liên hệ quản trị viên.
        </div>
      )}

      {/* ── Welcome Header (Stitch) ── */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold" style={{ color: C.onSurface }}>
          Tổng quan hệ thống
        </h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/teacher/attendance")}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: C.deepBlue }}
          >
            <Ms name="how_to_reg" className="!text-[20px]" />
            <span>Điểm danh</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/teacher/homework")}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: C.primaryContainer }}
          >
            <Ms name="add_task" className="!text-[20px]" />
            <span>Tạo bài tập</span>
          </button>
        </div>
      </div>

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Main column (col 1-8) */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-8">
          {/* School Activity Chart */}
          <div className={`${CARD} p-6`}>
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>
                Hoạt động trường học
              </h3>
              <div
                className="flex cursor-pointer items-center gap-1 text-sm"
                style={{ color: C.onSurfaceVariant }}
                title={primaryClass ? `Lớp ${primaryClass.className}` : ""}
              >
                <span>7 ngày qua</span>
                <Ms name="expand_more" className="!text-[15px]" />
              </div>
            </div>
            {loading ? (
              <div className="h-48 animate-pulse rounded-[2rem] bg-slate-200/60" />
            ) : (
              <ActivityBarChart data={data?.weeklyAttendance} />
            )}
          </div>

          {/* Integrated Key Metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {metricTiles.map((t) => (
              <div
                key={t.label}
                className="flex flex-col items-center rounded-[2rem] border bg-white p-4 text-center shadow-sm"
                style={{ borderColor: "rgba(223,192,178,0.3)" }}
              >
                <Ms name={t.ms} className="mb-1" style={{ color: t.color }} />
                <p className="text-[10px] font-bold uppercase tracking-tight" style={{ color: C.onSurfaceVariant }}>
                  {t.label}
                </p>
                {loading ? (
                  <div className="mt-1 h-6 w-12 animate-pulse rounded-md bg-slate-100" />
                ) : (
                  <p className="mt-1 text-xl font-extrabold leading-none" style={{ color: C.onSurface }}>
                    {t.value}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Students At Risk */}
          <div className={`${CARD} p-6`}>
            <div className="mb-8 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold" style={{ color: C.onSurface }}>
                <Ms name="report_problem" style={{ color: C.error }} />
                Học sinh cần lưu ý
              </h3>
              <button
                type="button"
                onClick={() => navigate("/teacher/students")}
                className="text-sm font-bold hover:underline"
                style={{ color: C.secondary }}
              >
                Chi tiết báo cáo
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((n) => (
                  <div key={n} className="h-12 animate-pulse rounded-[2rem] bg-slate-200/60" />
                ))}
              </div>
            ) : !atRisk.length ? (
              <div
                className="flex h-40 items-center justify-center rounded-[2rem] border border-dashed text-sm text-slate-400"
                style={{ borderColor: C.outlineVariant, backgroundColor: C.surface }}
              >
                Không có học sinh cần lưu ý
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* Risk Table */}
                <div className="overflow-x-auto xl:col-span-2">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.outlineVariant}` }}>
                        {["HỌ TÊN", "ĐTB", "CHUYÊN CẦN", "TRẠNG THÁI", "HÀNH ĐỘNG"].map((h, i) => (
                          <th
                            key={h}
                            className={`px-2 py-3 text-xs font-bold uppercase ${i === 4 ? "text-center" : ""}`}
                            style={{ color: C.onSurfaceVariant }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {atRisk.map((s, idx) => {
                        const critical = s.absenceRate >= 40;
                        const attendRate = Math.max(0, 100 - (s.absenceRate ?? 0));
                        const avColors = [C.primary, C.secondary, C.tertiary];
                        const avColor = avColors[idx % 3];
                        return (
                          <tr
                            key={s.studentId}
                            onClick={() => navigate(`/teacher/students/${s.studentId}`)}
                            className="cursor-pointer transition-colors hover:bg-[#F3F3F3]"
                            style={{ borderBottom: `1px solid ${C.outlineVariant}40` }}
                          >
                            <td className="px-2 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold"
                                  style={{ backgroundColor: `${avColor}1A`, color: avColor }}
                                >
                                  {s.avatar ? (
                                    <img src={s.avatar} alt={s.fullName} className="h-8 w-8 rounded-full object-cover" />
                                  ) : (
                                    initials(s.fullName)
                                  )}
                                </div>
                                <span className="text-sm font-bold" style={{ color: C.onSurface }}>
                                  {s.fullName}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-4 text-sm font-medium" style={{ color: C.onSurface }}>
                              —
                            </td>
                            <td
                              className="px-2 py-4 text-sm font-medium"
                              style={{ color: attendRate < 80 ? C.error : C.onSurfaceVariant }}
                            >
                              {attendRate}%
                            </td>
                            <td className="px-2 py-4">
                              <span
                                className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold"
                                style={
                                  critical
                                    ? { backgroundColor: C.errorContainer, color: C.onErrorContainer }
                                    : { backgroundColor: "rgba(242,113,35,0.2)", color: C.primaryContainer }
                                }
                              >
                                {critical ? "NGUY CẤP" : "CẢNH BÁO"}
                              </span>
                            </td>
                            <td className="px-2 py-4 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("/teacher/messages");
                                }}
                                className="rounded-full p-2 transition-colors hover:bg-[#225DAD]/10"
                                style={{ color: C.secondary }}
                                title="Liên hệ phụ huynh"
                              >
                                <Ms name="mail" className="!text-[20px]" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Risk Analysis Mini Chart */}
                <div className="flex flex-col rounded-[2rem] p-4" style={{ backgroundColor: C.surfaceLow }}>
                  <p className="mb-4 text-xs font-bold uppercase" style={{ color: C.onSurfaceVariant }}>
                    Phân tích nguy cơ (%)
                  </p>
                  <div className="flex flex-1 flex-col justify-center gap-3">
                    {riskBars.map((b) => (
                      <div key={b.label}>
                        <div className="mb-1 flex justify-between text-[11px]">
                          <span className="font-bold" style={{ color: C.onSurface }}>{b.label}</span>
                          <span className="font-bold" style={{ color: b.color }}>{b.value}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                          <div className="h-full" style={{ width: `${b.value}%`, backgroundColor: b.color }} />
                        </div>
                      </div>
                    ))}
                    <div
                      className="mt-4 rounded-xl border bg-white p-3"
                      style={{ borderColor: `${C.outlineVariant}80` }}
                    >
                      <p className="text-[10px] leading-tight" style={{ color: C.onSurfaceVariant }}>
                        Hiện có{" "}
                        <span className="font-bold" style={{ color: C.error }}>
                          {atRisk.length} học sinh
                        </span>{" "}
                        vắng ≥ 20% số buổi trong học kỳ này.
                      </p>
                    </div>
                  </div>
                </div>
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
                  TỔNG CỘNG {pendingSubmissions}
                </span>
              </div>
              {homeworks.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Không có bài tập nào đang mở.
                </p>
              ) : (
                <div className="space-y-4">
                  {homeworks.slice(0, 2).map((hw) => {
                    const pct =
                      hw.totalStudents > 0
                        ? Math.round((hw.totalSubmissions / hw.totalStudents) * 100)
                        : 0;
                    const dl = dueLabel(hw.dueDate);
                    return (
                      <button
                        key={hw.homeworkId}
                        type="button"
                        onClick={() => navigate(`/teacher/homework/${hw.homeworkId}`)}
                        className="group w-full rounded-xl border p-3 text-left transition-colors hover:border-[#9F4200]"
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
                        <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
                          {hw.className ? `Lớp ${hw.className}` : ""} - Đã nộp {hw.totalSubmissions}/{hw.totalStudents}
                        </p>
                        <div className="mt-2 h-1.5 w-full rounded-full" style={{ backgroundColor: C.surfaceHigh }}>
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 75 ? C.primary : C.secondary,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Today's Attendance Widget */}
            <div className={`${CARD} p-6`}>
              <h3 className="mb-4 text-base font-bold" style={{ color: C.onSurface }}>
                Điểm danh trong ngày
              </h3>
              <div
                className="mb-4 flex items-center justify-between rounded-[2rem] p-4"
                style={{ backgroundColor: "rgba(214,227,255,0.3)" }}
              >
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: C.secondary }}>
                    {todayAtt && todayAtt.total > 0 ? todayAtt.present : "—"}
                  </p>
                  <p className="text-xs font-bold uppercase" style={{ color: C.secondary }}>
                    Có mặt
                  </p>
                </div>
                <div className="h-12 w-px" style={{ backgroundColor: "rgba(34,93,173,0.2)" }} />
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: C.error }}>
                    {todayAbsent ?? "—"}
                  </p>
                  <p className="text-xs font-bold uppercase" style={{ color: C.error }}>
                    Vắng mặt
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase" style={{ color: C.onSurfaceVariant }}>
                  Học sinh vắng không phép
                </p>
                <p className="text-sm" style={{ color: C.onSurface }}>
                  {todayAtt && todayAtt.total > 0
                    ? `${todayAtt.absentUnexcused} học sinh`
                    : "Chưa điểm danh hôm nay"}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/teacher/messages")}
                  className="mt-4 w-full rounded-full border py-2 text-center text-sm font-bold transition-colors hover:text-[#00458E]"
                  style={{ borderColor: C.secondary, color: C.secondary }}
                >
                  Liên hệ phụ huynh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column (col 9-12) */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          {/* Quick Actions */}
          <div className="rounded-[2rem] p-6 text-white shadow-md" style={{ backgroundColor: C.deepBlue }}>
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
                onClick={() => navigate("/teacher/events")}
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
                    onClick={() => navigate(`/teacher/events/${e.eventId}`)}
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
            <h3 className="mb-4 text-base font-bold" style={{ color: C.onSurface }}>
              Hoạt động gần đây
            </h3>
            <div className="relative space-y-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-[#DFC0B2]">
              {activities.map((a) => (
                <div key={a.title} className="relative pl-8">
                  <div
                    className="absolute left-0 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white"
                    style={{ borderColor: a.color }}
                  >
                    <Ms name={a.ms} className="!text-[12px]" style={{ color: a.color }} />
                  </div>
                  <p className="text-sm font-bold" style={{ color: C.onSurface }}>
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
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export { TeacherDashboard };
