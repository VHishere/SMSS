import { useMemo } from "react";
import { FiBookOpen, FiCalendar, FiGrid, FiUsers } from "react-icons/fi";

import WeeklyTimetable from "../../components/organisms/WeeklyTimetable";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/AuthContext";
import { useStudentTimetable } from "../../hooks/useStudentTimetable";

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
        <p className="mb-1 text-xs font-medium text-slate-500">
          {label}
        </p>

        <p className="mb-0 text-base font-bold text-[#0F2747]">
          {value || "Chưa cập nhật"}
        </p>
      </div>
    </div>
  );
}

function StudentTimetable() {
  const { user } = useAuth();

  const {
    data,
    loading,
    error,
  } = useStudentTimetable();

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
              <p
                className="
                  mb-2 text-xs font-bold
                  uppercase tracking-[0.18em]
                  text-[#F27123]
                "
              >
                Học tập
              </p>

              <h1 className="mb-2 text-3xl font-bold text-[#0F2747]">
                Thời khóa biểu
              </h1>

              <p className="mb-0 text-sm text-slate-500">
                Xem thời khóa biểu của lớp theo tuần.
              </p>
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

export default StudentTimetable;