import {
  FiAward,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFlag,
  FiGrid,
  FiList,
} from "react-icons/fi";
import { Link } from "react-router-dom";

import StatusPill from "../../components/atoms/StatusPill";
import LoadingState from "../../components/atoms/LoadingState";
import ErrorAlert from "../../components/atoms/ErrorAlert";

import EmptyState from "../../components/molecules/EmptyState";
import StudentHero from "../../components/molecules/StudentHero";
import StudentStatCard from "../../components/molecules/StudentStatCard";

import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

import { useStudentDashboard } from "../../hooks/useStudentDashboard";
import { formatDateTime } from "../../utils/dateFormat";

function attendanceRate(attendance) {
  const total = Number(attendance?.totalAttendance || 0);

  if (total === 0) return "0%";

  return `${Math.round((Number(attendance?.presentCount || 0) / total) * 100)}%`;
}

function NotificationItem({ item }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="mb-0 text-sm font-bold text-[#0F2747]">
          {item.title}
        </p>

        {!item.isRead && (
          <StatusPill tone="orange">
            Mới
          </StatusPill>
        )}
      </div>

      {item.content && (
        <p className="mb-2 line-clamp-2 text-sm text-slate-500">
          {item.content}
        </p>
      )}

      <p className="mb-0 text-xs text-slate-400">
        {item.createdAt}
      </p>
    </div>
  );
}

function EventItem({ item }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="mb-0 text-sm font-bold text-[#0F2747]">
          {item.title}
        </p>

        {item.isRegistered && (
          <StatusPill tone="green">
            Đã đăng ký
          </StatusPill>
        )}
      </div>

      <p className="mb-1 text-sm text-slate-600">
        {formatDateTime(item.startDate)}
      </p>

      <p className="mb-0 text-xs text-slate-400">
        {item.location || "Chưa cập nhật địa điểm"}
      </p>
    </div>
  );
}

function StudentDashboard() {
  const { data, loading, error } = useStudentDashboard();
  const context = data?.context;

  return (
    <StudentDashboardShell context={context}>
      <StudentHero
        icon={FiGrid}
        eyebrow="Student Portal"
        title={`Xin chào, ${context?.fullName || "học sinh"}`}
        description="Theo dõi bài tập, điểm số, chuyên cần, mục tiêu, thông báo và các hoạt động quan trọng trong một màn hình."
      >
        <div className="grid w-full gap-4 rounded-2xl border border-orange-100 bg-white px-5 py-4 shadow-sm sm:grid-cols-2 lg:w-auto lg:min-w-[420px]">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              Lớp hiện tại
            </p>
            <p className="mb-0 text-base font-bold text-[#0F2747]">
              {context?.className || "Chưa cập nhật"}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              Năm học
            </p>
            <p className="mb-0 text-base font-bold text-[#0F2747]">
              {context?.schoolYearName || "Chưa cập nhật"}
            </p>
          </div>
        </div>
      </StudentHero>

      {loading && (
        <LoadingState label="Đang tải dashboard học sinh..." />
      )}

      {!loading && error && (
        <ErrorAlert error={`Không tải được dashboard: ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StudentStatCard
              icon={FiBookOpen}
              label="Bài tập chưa nộp"
              value={
                Number(data.homework?.pendingHomework || 0) +
                Number(data.homework?.overdueHomework || 0)
              }
              hint={`${data.homework?.submittedHomework || 0}/${data.homework?.totalHomework || 0} đã nộp`}
              tone="orange"
            />

            <StudentStatCard
              icon={FiAward}
              label="Điểm trung bình"
              value={data.grades?.averageScore || "—"}
              hint={`${data.grades?.totalScores || 0} đầu điểm`}
              tone="blue"
            />

            <StudentStatCard
              icon={FiCalendar}
              label="Tỷ lệ có mặt 30 ngày"
              value={attendanceRate(data.attendance)}
              hint={`${data.attendance?.lateCount || 0} lần muộn`}
              tone="green"
            />

            <StudentStatCard
              icon={FiFlag}
              label="Tiến độ mục tiêu"
              value={`${data.goals?.averageProgress || 0}%`}
              hint={`${data.goals?.completedGoals || 0} hoàn thành`}
              tone="purple"
            />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="mb-1 text-base font-bold text-[#0F2747]">
                    Việc cần chú ý
                  </h3>
                  <p className="mb-0 text-sm text-slate-500">
                    Các chỉ số quan trọng trong quá trình học tập.
                  </p>
                </div>

                <Link
                  to="/student/homeworks"
                  className="rounded-xl border border-[#08509F] bg-white px-4 py-2 text-sm font-semibold text-[#08509F] no-underline transition hover:bg-blue-50"
                >
                  Xem bài tập
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#FFF7F2] p-4">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#F27123]">
                    <FiClock size={20} />
                  </div>
                  <p className="mb-1 text-sm font-bold text-[#0F2747]">
                    Bài tập quá hạn
                  </p>
                  <p className="mb-0 text-3xl font-bold text-[#F27123]">
                    {data.homework?.overdueHomework || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-4">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#08509F]">
                    <FiList size={20} />
                  </div>
                  <p className="mb-1 text-sm font-bold text-[#0F2747]">
                    Vắng không phép 30 ngày
                  </p>
                  <p className="mb-0 text-3xl font-bold text-[#08509F]">
                    {data.attendance?.unexcusedAbsentCount || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-green-50 p-4">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-green-600">
                    <FiCheckCircle size={20} />
                  </div>
                  <p className="mb-1 text-sm font-bold text-[#0F2747]">
                    Mục tiêu đang thực hiện
                  </p>
                  <p className="mb-0 text-3xl font-bold text-green-600">
                    {data.goals?.inProgressGoals || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-50 p-4">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-purple-600">
                    <FiBell size={20} />
                  </div>
                  <p className="mb-1 text-sm font-bold text-[#0F2747]">
                    Thông báo mới nhất
                  </p>
                  <p className="mb-0 text-3xl font-bold text-purple-600">
                    {data.recentNotifications?.filter((n) => !n.isRead).length || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="mb-1 text-base font-bold text-[#0F2747]">
                    Thông báo
                  </h3>
                  <p className="mb-0 text-sm text-slate-500">
                    Thông báo gần đây.
                  </p>
                </div>

                <Link
                  to="/student/notifications"
                  className="text-sm font-bold text-[#F27123] no-underline"
                >
                  Xem tất cả
                </Link>
              </div>

              <div className="space-y-3">
                {data.recentNotifications?.length ? (
                  data.recentNotifications.map((item) => (
                    <NotificationItem
                      key={item.notificationId}
                      item={item}
                    />
                  ))
                ) : (
                  <EmptyState title="Chưa có thông báo" />
                )}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="mb-1 text-base font-bold text-[#0F2747]">
                  Sự kiện sắp tới
                </h3>
                <p className="mb-0 text-sm text-slate-500">
                  Hoạt động lớp/trường có liên quan đến học sinh.
                </p>
              </div>

              <Link
                to="/student/events"
                className="text-sm font-bold text-[#F27123] no-underline"
              >
                Xem sự kiện
              </Link>
            </div>

            {data.upcomingEvents?.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.upcomingEvents.map((item) => (
                  <EventItem
                    key={item.eventId}
                    item={item}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có sự kiện sắp tới" />
            )}
          </section>
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentDashboard;