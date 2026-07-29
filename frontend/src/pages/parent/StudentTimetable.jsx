import { useMemo } from "react";
import { FiBookOpen, FiGrid, FiUsers } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";

import WeeklyTimetable from "../../components/organisms/WeeklyTimetable";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentTimetable } from "../../hooks/useParentStudentTimetable";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

function InfoItem({ icon: Icon, label, value, colorClass }) {
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
        <p className="mb-0 text-[11px] font-medium text-slate-500">{label}</p>
        <p className="mb-0 text-sm font-bold text-[#0F2747]">
          {value || "Chưa cập nhật"}
        </p>
      </div>
    </div>
  );
}

function ParentStudentTimetable() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { students, loading: studentsLoading } = useParentStudents();

  const selectedId = searchParams.get("student")
    ? parseInt(searchParams.get("student"), 10)
    : null;

  const activeStudentId = useMemo(() => {
    if (studentsLoading || students.length === 0) return null;
    if (selectedId && students.some((s) => s.studentId === selectedId)) {
      return selectedId;
    }
    return students[0].studentId;
  }, [students, studentsLoading, selectedId]);

  const { data, loading, error } = useParentStudentTimetable(activeStudentId);

  const headerUser = useMemo(() => {
    const parentRole = user?.roles?.find((role) => role.roleName === "PARENT");

    return {
      name: user?.fullName || user?.username || "Phụ huynh",
      role: parentRole?.description || "Phụ huynh",
      avatar: user?.avatar || "",
    };
  }, [user]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {/* Student selector + Class/Grade/Year info — same row */}
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {!studentsLoading && students.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {students.map((student) => (
              <button
                key={student.studentId}
                type="button"
                onClick={() => setSearchParams({ student: student.studentId })}
                className={`
                  rounded-xl px-4 py-2 text-sm font-medium
                  transition
                  ${
                    student.studentId === activeStudentId
                      ? "bg-[#08509F] text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }
                `}
              >
                {student.studentFullName}
                {student.className && (
                  <span className="ml-1.5 opacity-70">· {student.className}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        <div
          className="
            flex flex-wrap items-center justify-end
            gap-6 rounded-3xl border card-border
            bg-white px-5 py-3 shadow-sm
          "
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
        </div>
      </section>

      {/* Timetable content */}
      {loading && (
        <div
          className="
            rounded-3xl border card-border
            bg-white p-8 text-center
            text-sm text-slate-500 shadow-sm
          "
        >
          Đang tải thời khóa biểu...
        </div>
      )}

      {error && (
        <div
          className="
            rounded-2xl border border-red-200
            bg-red-50 px-5 py-4
            text-sm text-red-600
          "
        >
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

export default ParentStudentTimetable;
