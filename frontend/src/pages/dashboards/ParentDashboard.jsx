import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiBell, FiClock, FiUser } from "react-icons/fi";

import { parentApi } from "../../api/client";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentNotifications } from "../../hooks/useParentNotifications";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

function StudentCard({ student }) {
  return (
    <div
      className="
        flex flex-col rounded-2xl
        border border-orange-100
        bg-white p-5 shadow-sm
      "
    >
      <div className="flex items-start gap-4">
        {student.studentAvatar ? (
          <img
            src={student.studentAvatar}
            alt={student.studentFullName}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="
              flex h-12 w-12 shrink-0
              items-center justify-center
              rounded-full bg-[#08509F]
              text-lg font-bold text-white
            "
          >
            {student.studentFullName?.[0] || "?"}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="truncate text-base font-bold text-[#0F2747]">
              {student.studentFullName}
            </h4>
          </div>

          <p className="mb-0.5 text-xs text-slate-500">
            Mã HS: {student.studentCode} · {student.relationship}
          </p>

          {student.className ? (
            <p className="mb-0 text-xs font-medium text-[#08509F]">
              {student.className} · {student.gradeName} · {student.schoolYearName}
            </p>
          ) : (
            <p className="mb-0 text-xs text-slate-400">Chưa xếp lớp</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          to={`/parent/student/${student.studentId}`}
          className="
            flex flex-1 items-center justify-center
            gap-1.5 rounded-lg border border-slate-200
            px-3 py-2 text-xs font-medium
            text-slate-600 transition hover:bg-slate-50
          "
        >
          <FiUser size={13} />
          Hồ sơ
        </Link>

        {student.classId && (
          <Link
            to={`/parent/timetable?student=${student.studentId}`}
            className="
              flex flex-1 items-center justify-center
              gap-1.5 rounded-lg bg-[#08509F]
              px-3 py-2 text-xs font-medium
              text-white transition hover:bg-[#06408A]
            "
          >
            <FiClock size={13} />
            Thời khóa biểu
          </Link>
        )}
      </div>
    </div>
  );
}

function getNotificationTypeLabel(type) {
  const map = {
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

  return map[type] || type || "Thông báo";
}

function ParentDashboard() {
  const { user } = useAuth();

  const [parentProfile, setParentProfile] = useState(null);
  const [profileError, setProfileError] = useState("");

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

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={
        studentsLoading ? "Đang tải..." : getCurrentSchoolYearLabel(students)
      }
    >
      {profileError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được hồ sơ phụ huynh: {profileError}
        </div>
      )}

      {/* Statistics placeholder */}
      <section className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
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
        {/* Linked students */}
        <div
          className="
            rounded-2xl border border-orange-100
            bg-white p-6 shadow-sm xl:col-span-2
          "
        >
          <div className="mb-5">
            <h3 className="mb-1 text-base font-bold text-[#0F2747]">
              Danh sách học sinh
            </h3>

            <p className="mb-0 text-sm text-slate-500">
              Các học sinh được liên kết với tài khoản của bạn.
            </p>
          </div>

          {studentsLoading && (
            <div className="flex min-h-40 items-center justify-center text-sm text-slate-400">
              Đang tải...
            </div>
          )}

          {studentsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              Không tải được danh sách học sinh: {studentsError}
            </div>
          )}

          {!studentsLoading && !studentsError && students.length === 0 && (
            <div
              className="
                flex min-h-40 items-center justify-center
                rounded-xl border border-dashed
                border-slate-200 bg-slate-50
                text-sm text-slate-400
              "
            >
              Chưa có học sinh nào được liên kết
            </div>
          )}

          {!studentsLoading && students.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {students.map((student) => (
                <StudentCard
                  key={student.studentId}
                  student={student}
                />
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-2">
            <div>
              <h3 className="mb-1 text-base font-bold text-[#0F2747]">
                Thông báo
              </h3>

              <p className="mb-0 text-sm text-slate-500">
                Sự kiện và thông báo mới.
              </p>
            </div>

            {notifData?.summary?.unreadNotifications > 0 && (
              <span
                className="
                  shrink-0 rounded-full bg-[#F27123]
                  px-2 py-0.5 text-xs
                  font-bold text-white
                "
              >
                {notifData.summary.unreadNotifications} mới
              </span>
            )}
          </div>

          {notifLoading && (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-400">
              Đang tải...
            </div>
          )}

          {!notifLoading && (!notifData?.items || notifData.items.length === 0) && (
            <div
              className="
                flex min-h-48 flex-col items-center
                justify-center gap-2 rounded-xl
                border border-dashed border-orange-200
                bg-[#FFF7F2] text-slate-400
              "
            >
              <FiBell size={28} />
              <p className="mb-0 text-sm">Chưa có thông báo</p>
            </div>
          )}

          {!notifLoading && notifData?.items?.length > 0 && (
            <div className="space-y-2">
              {notifData.items.map((item) => (
                <div
                  key={item.notificationId}
                  className={`
                    rounded-xl p-3
                    ${item.isRead ? "bg-slate-50" : "bg-[#FFF7F2] border border-[#F27123]/20"}
                  `}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className="
                        rounded-full bg-orange-50 px-2 py-0.5
                        text-[11px] font-bold text-[#F27123]
                      "
                    >
                      {getNotificationTypeLabel(item.type)}
                    </span>

                    {!item.isRead && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#F27123]" />
                    )}
                  </div>

                  <p className="mb-0.5 line-clamp-1 text-sm font-semibold text-[#0F2747]">
                    {item.title}
                  </p>

                  <p className="mb-0 text-[11px] text-slate-400">
                    {item.createdAt}
                  </p>
                </div>
              ))}

              <Link
                to="/parent/notifications"
                className="
                  mt-3 flex w-full items-center
                  justify-center gap-2 rounded-xl
                  bg-[#F27123] px-4 py-2.5
                  text-sm font-bold text-white
                  transition hover:bg-[#d95f17]
                "
              >
                Xem tất cả thông báo
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Recent activity placeholder */}
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
            border-slate-200 bg-slate-50
          "
        >
          <span className="text-sm font-medium text-slate-400">
            Activity table
          </span>
        </div>
      </section>
    </DashboardShell>
  );
}

export default ParentDashboard;
