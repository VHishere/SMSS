import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { studentApi } from "../../api/client";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/AuthContext";

function StudentDashboard() {
  const { user } = useAuth();

  const [
    studentProfile,
    setStudentProfile,
  ] = useState(null);

  const [
    profileError,
    setProfileError,
  ] = useState("");

  useEffect(() => {
    let isMounted = true;

    studentApi
      .getMyProfile()
      .then((response) => {
        if (isMounted) {
          setStudentProfile(response.data);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setProfileError(error.message);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const headerUser = useMemo(() => {
    const studentRole =
      user?.roles?.find(
        (role) =>
          role.roleName === "STUDENT",
      );

    return {
      name:
        studentProfile?.fullName ||
        user?.fullName ||
        user?.username ||
        "Học sinh",

      role:
        studentRole?.description ||
        "Học sinh",

      avatar:
        studentProfile?.avatar ||
        user?.avatar ||
        "",
    };
  }, [
    studentProfile,
    user,
  ]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.STUDENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={
        studentProfile?.schoolYearName ||
        "Chưa cập nhật"
      }
    >
      {profileError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được hồ sơ học sinh:{" "}
          {profileError}
        </div>
      )}

      {/* Statistic sẽ bổ sung sau */}
      <section className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              className="
                min-h-32 rounded-2xl
                border border-orange-100
                bg-white p-5 shadow-sm
              "
            >
              <div
                className="
                  flex h-full items-center
                  justify-center rounded-xl
                  border border-dashed
                  border-orange-200
                  bg-[#FFF7F2]
                "
              >
                <span className="text-sm font-medium text-slate-400">
                  Statistic component
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div
          className="
            rounded-2xl
            border border-orange-100
            bg-white p-6 shadow-sm
            xl:col-span-2
          "
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="mb-1 text-base font-bold text-[#0F2747]">
                Biểu đồ tổng quan
              </h3>

              <p className="mb-0 text-sm text-slate-500">
                Khu vực biểu đồ sẽ được bổ sung sau.
              </p>
            </div>

            <button
              type="button"
              className="
                rounded-lg border
                border-[#08509F]
                bg-white px-4 py-2
                text-sm font-semibold
                text-[#08509F]
                transition hover:bg-blue-50
              "
            >
              Xem báo cáo
            </button>
          </div>

          <div
            className="
              flex min-h-72 items-center
              justify-center rounded-xl
              border border-dashed
              border-blue-200
              bg-blue-50/40
            "
          >
            <span className="text-sm font-medium text-slate-400">
              Chart component
            </span>
          </div>
        </div>

        <div
          className="
            rounded-2xl
            border border-orange-100
            bg-white p-6 shadow-sm
          "
        >
          <div className="mb-5">
            <h3 className="mb-1 text-base font-bold text-[#0F2747]">
              Thông báo
            </h3>

            <p className="mb-0 text-sm text-slate-500">
              Sự kiện và thông báo mới.
            </p>
          </div>

          <div
            className="
              flex min-h-72 items-center
              justify-center rounded-xl
              border border-dashed
              border-orange-200
              bg-[#FFE7D6]/30
            "
          >
            <span className="text-sm font-medium text-slate-400">
              Notification component
            </span>
          </div>
        </div>
      </section>

      <section
        className="
          mt-6 rounded-2xl
          border border-orange-100
          bg-white p-6 shadow-sm
        "
      >
        <div className="mb-5">
          <h3 className="mb-1 text-base font-bold text-[#0F2747]">
            Hoạt động gần đây
          </h3>

          <p className="mb-0 text-sm text-slate-500">
            Danh sách hoạt động sẽ được thêm sau.
          </p>
        </div>

        <div
          className="
            flex min-h-52 items-center
            justify-center rounded-xl
            border border-dashed
            border-slate-200
            bg-slate-50
          "
        >
          <span className="text-sm font-medium text-slate-400">
            Student activity table
          </span>
        </div>
      </section>
    </DashboardShell>
  );
}

export default StudentDashboard;