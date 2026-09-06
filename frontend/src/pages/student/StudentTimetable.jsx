import { useMemo, useState } from "react";
import {
  FiBookOpen,
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiUsers,
} from "react-icons/fi";

import WeeklyTimetable from "../../components/organisms/WeeklyTimetable";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import {
  useAuth,
} from "../../context/useAuth";
import { useStudentTimetable } from "../../hooks/useStudentTimetable";

// Bảng màu chuẩn của hệ thống (giống các trang teacher). Viền đặt qua inline
// style vì utility `border-*` của Tailwind bị CSS unlayered của Bootstrap ghi đè
// (đo được: border-orange-100 ra #DEE2E6 xám thay vì #DFC0B2).
const C = { onSurface: "#1A1C1C", border: "#DFC0B2" };

function localDate(value = new Date()) {
  const p = (number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`;
}

function moveDate(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function InfoItem({
  icon: Icon,
  label,
  value,
  colorClass,
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`
          flex h-9 w-9 shrink-0 items-center justify-center
          rounded-full
          ${colorClass}
        `}
      >
        <Icon size={17} />
      </div>

      <div>
        <p className="mb-0 text-[11px] font-medium text-slate-500">
          {label}
        </p>

        <p className="mb-0 text-sm font-bold text-[#0F2747]">
          {value || "Chưa cập nhật"}
        </p>
      </div>
    </div>
  );
}

function StudentTimetable() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => localDate());

  const {
    data,
    loading,
    error,
  } = useStudentTimetable(selectedDate);

  const headerUser = useMemo(() => {
    const studentRole = user?.roles?.find(
      (role) => role.roleName === "STUDENT",
    );

    return {
      name:
        data?.context?.fullName ||
        user?.fullName ||
        user?.username ||
        "Học sinh",

      role:
        studentRole?.description ||
        "Học sinh",

      avatar:
        data?.context?.avatar ||
        user?.avatar ||
        "",
    };
  }, [data, user]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.STUDENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={
        data?.context?.schoolYearName ||
        "Chưa cập nhật"
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>
          Thời khóa biểu
        </h1>
        <div className="flex items-center gap-2">
          <button type="button" title="Tuần trước" onClick={() => setSelectedDate((value) => moveDate(value, -7))} className="grid h-11 w-11 place-items-center rounded-full border bg-white text-[#08509F]" style={{ borderColor: C.border }}><FiChevronLeft /></button>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-11 rounded-xl border bg-white px-3 text-sm font-semibold text-[#0F2747]" style={{ borderColor: C.border }} />
          <button type="button" title="Tuần sau" onClick={() => setSelectedDate((value) => moveDate(value, 7))} className="grid h-11 w-11 place-items-center rounded-full border bg-white text-[#08509F]" style={{ borderColor: C.border }}><FiChevronRight /></button>
        </div>
      </div>

      <section
        className="
          mb-6 grid gap-4 rounded-3xl bg-white px-5 py-4 shadow-sm
          sm:grid-cols-3
        "
        style={{ border: `1px solid ${C.border}` }}
      >
        <InfoItem
          icon={FiUsers}
          label="Lớp"
          value={data?.context?.className}
          colorClass="bg-orange-50 text-[#F27123]"
        />

        <InfoItem
          icon={FiGrid}
          label="Khối"
          value={data?.context?.gradeName}
          colorClass="bg-blue-50 text-[#08509F]"
        />

        <InfoItem
          icon={FiBookOpen}
          label="Năm học"
          value={data?.context?.schoolYearName}
          colorClass="bg-green-50 text-green-600"
        />
      </section>

      {loading && (
        <div
          className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm"
          style={{ border: `1px solid ${C.border}` }}
        >
          Đang tải thời khóa biểu...
        </div>
      )}

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Không tải được thời khóa biểu: {error}
        </div>
      )}

      {!loading && !error && data && (
        <WeeklyTimetable
          weekDays={data.weekDays}
          slots={data.slots}
          lessons={data.lessons}
        />
      )}
    </DashboardShell>
  );
}

export default StudentTimetable;
