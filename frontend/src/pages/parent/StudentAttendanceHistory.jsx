import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudentAttendance } from "../../hooks/useParentStudentAttendance";
import { useParentStudents } from "../../hooks/useParentStudents";

// ── Date utilities ────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatVN(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function getSchoolYears() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return Array.from({ length: 3 }, (_, i) => {
    const y = startYear - i;
    return { value: `${y}-${y + 1}`, label: `Năm học ${y} – ${y + 1}` };
  });
}

function getWeeksForSchoolYear(schoolYear) {
  const startYear = parseInt(schoolYear.split("-")[0], 10);
  const endYear = startYear + 1;

  const yearStart = new Date(startYear, 8, 1);  // 1 Sep
  const yearEnd = new Date(endYear, 4, 31);     // 31 May

  // Find Monday of the week containing Sep 1
  const dow = yearStart.getDay(); // 0=Sun, 1=Mon
  const firstMonday = new Date(yearStart);
  firstMonday.setDate(yearStart.getDate() + (dow === 0 ? -6 : 1 - dow));

  const weeks = [];
  let cur = new Date(firstMonday);
  let num = 1;

  while (cur <= yearEnd) {
    const end = new Date(cur);
    end.setDate(cur.getDate() + 6);

    weeks.push({
      value: toISO(cur),
      startDate: toISO(cur),
      endDate: toISO(end),
      label: `Tuần ${num} · ${formatVN(cur)} – ${formatVN(end)}`,
    });

    cur = new Date(cur);
    cur.setDate(cur.getDate() + 7);
    num++;
  }

  return weeks;
}

function findDefaultWeek(weeks) {
  if (weeks.length === 0) return "";
  const today = toISO(new Date());
  const found = weeks.find((w) => w.startDate <= today && w.endDate >= today);
  if (found) return found.value;
  if (today > weeks[weeks.length - 1].endDate) return weeks[weeks.length - 1].value;
  return weeks[0].value;
}

// ── Display helpers ───────────────────────────────────────────────────────────

const CONTEXT_LABEL = { CLASS: "Lớp học", DORM: "Ký túc xá" };

const VN_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatTableDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${VN_DAYS[d.getDay()]}, ${dd}/${mm}/${yyyy}`;
}

const ATTENDANCE_TYPE_CONFIG = {
  PRESENT:           { label: "Có mặt",        cls: "bg-green-100 text-green-700" },
  LATE:              { label: "Đi muộn",        cls: "bg-yellow-100 text-yellow-700" },
  ABSENT_EXCUSED:    { label: "Vắng có phép",   cls: "bg-orange-100 text-orange-700" },
  ABSENT_UNEXCUSED:  { label: "Vắng không phép",cls: "bg-red-100 text-red-700" },
  EARLY_LEAVE:       { label: "Về sớm",         cls: "bg-blue-100 text-blue-700" },
};

function StatusBadge({ typeName }) {
  if (!typeName) return <span className="text-slate-400">—</span>;
  const config = ATTENDANCE_TYPE_CONFIG[typeName.toUpperCase()] ?? {
    label: typeName,
    cls: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${config.cls}`}>
      {config.label}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const TABLE_COLS = ["STT", "NGÀY", "LOẠI", "LỚP / MÔN HỌC", "GIÁO VIÊN", "TRẠNG THÁI", "GHI CHÚ"];

function ParentStudentAttendanceHistory() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { students, loading: studentsLoading } = useParentStudents();

  // ── School year ──
  const schoolYears = useMemo(() => getSchoolYears(), []);

  // Combine year + weekStart into one state so changing the year resets the
  // week atomically in the onChange handler — no cascading useEffect needed.
  const [filter, setFilter] = useState(() => {
    const year = schoolYears[0].value;
    return { year, weekStart: findDefaultWeek(getWeeksForSchoolYear(year)) };
  });

  const { year: selectedYear, weekStart: selectedWeekStart } = filter;

  // ── Weeks ──
  const weeks = useMemo(() => getWeeksForSchoolYear(selectedYear), [selectedYear]);

  const selectedWeek = useMemo(
    () => weeks.find((w) => w.value === selectedWeekStart) ?? null,
    [weeks, selectedWeekStart],
  );

  // ── Active student ──
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

  // ── Attendance data ──
  const { data, loading, error } = useParentStudentAttendance(
    activeStudentId,
    selectedWeek?.startDate,
    selectedWeek?.endDate,
  );

  // Show earliest date first (backend returns DESC)
  const items = useMemo(() => [...(data?.items ?? [])].reverse(), [data]);

  // ── Header user ──
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
      sidebarFooterLabel="Năm học"
      sidebarFooterValue={selectedYear}
    >
      {/* Page header */}
      <section className="mb-6 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#F27123]">
          Theo dõi học sinh
        </p>
        <h1 className="mb-1 text-2xl font-bold text-[#0F2747] sm:text-3xl">
          Lịch sử điểm danh
        </h1>
        <p className="text-sm text-slate-500">
          Xem lịch sử điểm danh của học sinh theo từng tuần học.
        </p>
      </section>

      {/* Student selector — only when parent has multiple students */}
      {!studentsLoading && students.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSearchParams({ student: s.studentId })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                s.studentId === activeStudentId
                  ? "bg-[#08509F] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.studentFullName}
              {s.className && (
                <span className="ml-1.5 opacity-70">· {s.className}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Student info banner */}
      {activeStudent && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
          {activeStudent.studentAvatar ? (
            <img
              src={activeStudent.studentAvatar}
              alt={activeStudent.studentFullName}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#08509F] text-sm font-bold text-white">
              {activeStudent.studentFullName?.[0] ?? "?"}
            </div>
          )}
          <div>
            <span className="text-sm font-semibold text-[#0F2747]">
              {activeStudent.studentFullName}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              {activeStudent.studentCode} · {activeStudent.relationship}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Năm học</label>
          <select
            value={selectedYear}
            onChange={(e) => {
                const newYear = e.target.value;
                setFilter({ year: newYear, weekStart: findDefaultWeek(getWeeksForSchoolYear(newYear)) });
              }}
            className="
              rounded-lg border border-slate-200 bg-white
              px-3 py-2 text-sm text-[#0F2747] shadow-sm
              outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]
            "
          >
            {schoolYears.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Tuần học</label>
          <select
            value={selectedWeekStart}
            onChange={(e) => setFilter((prev) => ({ ...prev, weekStart: e.target.value }))}
            className="
              min-w-[280px] rounded-lg border border-slate-200
              bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm
              outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]
            "
          >
            {weeks.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải dữ liệu điểm danh...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Không tải được dữ liệu: {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Không có dữ liệu điểm danh trong tuần này.
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
                      key={row.attendanceId}
                      className={`border-b border-slate-50 ${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"}`}
                    >
                      <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-[#0F2747]">
                        {formatTableDate(row.attendanceDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {CONTEXT_LABEL[row.context] ?? row.context ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.subjectName ?? row.className ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.createdByName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge typeName={row.typeName} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {row.note ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}

export default ParentStudentAttendanceHistory;
