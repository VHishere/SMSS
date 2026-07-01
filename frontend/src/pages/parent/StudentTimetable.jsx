import { useMemo } from "react";
import { FiBookOpen, FiCalendar, FiGrid, FiUsers } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";

import WeeklyTimetable from "../../components/organisms/WeeklyTimetable";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentTimetable } from "../../hooks/useParentStudentTimetable";

function InfoItem({ icon: Icon, label, value, colorClass }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`
          flex h-11 w-11 shrink-0 items-center justify-center
          rounded-full
          ${colorClass}
        `}
      >
        <Icon size={20} />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
        <p className="mb-0 text-base font-bold text-[#0F2747]">
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

  const activeStudent = useMemo(
    () => students.find((s) => s.studentId === activeStudentId) || null,
    [students, activeStudentId],
  );

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
      sidebarFooterValue={data?.context?.schoolYearName || "Chưa cập nhật"}
    >
      {/* Page header */}
      <section
        className="
          mb-6 overflow-hidden rounded-3xl
          border border-orange-100
          bg-white shadow-sm
        "
      >
        <div
          className="
            flex flex-wrap items-center justify-between
            gap-6 px-6 py-6 lg:px-8
          "
        >
          <div className="flex items-center gap-5">
            <div
              className="
                flex h-20 w-20 shrink-0
                items-center justify-center
                rounded-full bg-[#FFE7D6]
                text-[#F27123]
              "
            >
              <FiCalendar size={34} />
            </div>

            <div>

              <h1 className="mb-2 text-3xl font-bold text-[#0F2747]">
                Thời khóa biểu
              </h1>
            </div>
          </div>

          <div
            className="
              grid w-full gap-4 rounded-2xl
              border border-orange-100
              bg-white px-5 py-4
              shadow-sm
              sm:grid-cols-3 lg:w-auto
              lg:min-w-[560px]
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
        </div>
      </section>

      {/* Student selector — only shown when parent has multiple students */}
      {!studentsLoading && students.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {students.map((student) => (
            <button
              key={student.studentId}
              type="button"
              onClick={() => setSearchParams({ student: student.studentId })}
              className={`
                rounded-full px-4 py-2 text-sm font-medium
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
      )}

      {/* Student info banner */}
      {activeStudent && (
        <div
          className="
            mb-6 flex items-center gap-3
            rounded-xl border border-blue-100
            bg-blue-50/50 px-4 py-3
          "
        >
          {activeStudent.studentAvatar ? (
            <img
              src={activeStudent.studentAvatar}
              alt={activeStudent.studentFullName}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="
                flex h-8 w-8 shrink-0 items-center
                justify-center rounded-full
                bg-[#08509F] text-sm
                font-bold text-white
              "
            >
              {activeStudent.studentFullName?.[0] || "?"}
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

      {/* Timetable content */}
      {loading && (
        <div
          className="
            rounded-2xl border border-orange-100
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
