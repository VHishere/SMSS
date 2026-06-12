import {
  useMemo,
} from "react";

import WeeklyTimetable from "../../components/organisms/WeeklyTimetable";

import DashboardShell from "../../components/templates/DashboardShell";

import {
  dashboardNavigation,
} from "../../config/dashboardNavigation";

import {
  useAuth,
} from "../../context/useAuth";

import {
  useStudentTimetable,
} from "../../hooks/useStudentTimetable";

function StudentTimetable() {
  const { user } = useAuth();

  const {
    data,
    loading,
    error,
  } = useStudentTimetable();

  const headerUser = useMemo(() => {
    const studentRole =
      user?.roles?.find(
        (role) =>
          role.roleName === "STUDENT",
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
  }, [
    data,
    user,
  ]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={
        dashboardNavigation.STUDENT
      }
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={
        data?.context?.schoolYearName ||
        "Chưa cập nhật"
      }
    >
      <section
        className="
          mb-6 rounded-2xl
          border border-orange-100
          bg-white p-5 shadow-sm
          sm:p-6
        "
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
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

            <h1 className="mb-2 text-2xl font-bold text-[#0F2747] sm:text-3xl">
              Thời khóa biểu
            </h1>

            <p className="mb-0 text-sm text-slate-500">
              Theo dõi lịch học theo từng
              tiết trong tuần.
            </p>
          </div>

          <div className="rounded-xl bg-[#FFF7F2] px-4 py-3 text-right">
            <p className="mb-1 text-xs text-slate-500">
              Lớp hiện tại
            </p>

            <p className="mb-0 font-bold text-[#0F2747]">
              {data?.context?.className ||
                "Đang tải..."}
            </p>

            {data?.context
              ?.classRoom && (
              <p className="mb-0 mt-1 text-xs text-[#08509F]">
                Phòng chủ nhiệm{" "}
                {
                  data.context
                    .classRoom
                }
              </p>
            )}
          </div>
        </div>
      </section>

      {loading && (
        <div
          className="
            rounded-2xl
            border border-orange-100
            bg-white p-8 text-center
            text-sm text-slate-500
            shadow-sm
          "
        >
          Đang tải thời khóa biểu...
        </div>
      )}

      {error && (
        <div
          className="
            rounded-2xl
            border border-red-200
            bg-red-50 px-5 py-4
            text-sm text-red-600
          "
        >
          Không tải được thời khóa biểu:{" "}
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        data && (
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