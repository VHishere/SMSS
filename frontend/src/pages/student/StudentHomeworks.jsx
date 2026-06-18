import { useMemo } from "react";

import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiFileText,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useStudentHomeworks } from "../../hooks/useStudentHomeworks";

function formatDateTime(value) {
  if (!value) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusInfo(status) {
  const map = {
    PENDING: {
      label: "Chưa nộp",
      className: "bg-amber-50 text-amber-700",
      dotClassName: "bg-amber-500",
    },
    OVERDUE: {
      label: "Quá hạn",
      className: "bg-red-50 text-red-600",
      dotClassName: "bg-red-500",
    },
    SUBMITTED: {
      label: "Đã nộp",
      className: "bg-green-50 text-green-700",
      dotClassName: "bg-green-500",
    },
  };

  return map[status] || map.PENDING;
}

function CompactStat({
  label,
  value,
  icon: Icon,
  className = "bg-slate-50 text-slate-700",
}) {
  return (
    <div
      className={`
        flex items-center gap-2
        rounded-full px-3 py-2
        text-sm font-semibold
        ${className}
      `}
    >
      <Icon size={15} />

      <span>{label}</span>

      <span className="font-bold">
        {value}
      </span>
    </div>
  );
}

function HomeworkCard({ homework }) {
  const currentStatus = statusInfo(
    homework.studentHomeworkStatus,
  );

  return (
    <article
      className="
        rounded-2xl border border-orange-100
        bg-white p-5 shadow-sm
        transition hover:-translate-y-0.5
        hover:shadow-md
      "
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#08509F]">
            {homework.subjectName}
          </span>

          <span
            className={`
              inline-flex items-center gap-1.5
              rounded-full px-3 py-1
              text-xs font-bold
              ${currentStatus.className}
            `}
          >
            <span
              className={`
                h-1.5 w-1.5 rounded-full
                ${currentStatus.dotClassName}
              `}
            />
            {currentStatus.label}
          </span>
        </div>

        <div
          className="
            inline-flex items-center gap-2
            rounded-full bg-[#FFF7F2]
            px-3 py-1.5
            text-xs font-bold text-[#F27123]
          "
        >
          <FiClock size={14} />
          <span>
            Hạn: {formatDateTime(homework.dueDate)}
          </span>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-lg font-bold text-[#0F2747]">
          {homework.title}
        </h3>

        <p className="mb-0 text-sm leading-6 text-slate-600">
          {homework.content || "Không có mô tả chi tiết."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <FiCheckCircle className="text-slate-400" />
          <span>
            Điểm: {homework.score ?? "Chưa chấm"}
          </span>
        </div>

        {homework.submitTime && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FiFileText className="text-slate-400" />
            <span>
              Đã nộp: {formatDateTime(homework.submitTime)}
            </span>
          </div>
        )}
      </div>

      {homework.feedback && (
        <div className="mt-4 rounded-xl bg-[#FFF7F2] px-4 py-3 text-sm text-slate-600">
          <span className="font-bold text-[#0F2747]">
            Nhận xét:
          </span>{" "}
          {homework.feedback}
        </div>
      )}
    </article>
  );
}

function StudentHomeworks() {
  const { user } = useAuth();

  const {
    data,
    loading,
    error,
  } = useStudentHomeworks();

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
      role: studentRole?.description || "Học sinh",
      avatar: data?.context?.avatar || user?.avatar || "",
    };
  }, [data, user]);

  const summary = useMemo(() => {
    const homeworks = data?.homeworks || [];

    return {
      total: homeworks.length,
      pending: homeworks.filter(
        (item) => item.studentHomeworkStatus === "PENDING",
      ).length,
      submitted: homeworks.filter(
        (item) => item.studentHomeworkStatus === "SUBMITTED",
      ).length,
      overdue: homeworks.filter(
        (item) => item.studentHomeworkStatus === "OVERDUE",
      ).length,
    };
  }, [data]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.STUDENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={
        data?.context?.schoolYearName || "Chưa cập nhật"
      }
    >
      {loading && (
        <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải danh sách bài tập...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Không tải được bài tập về nhà: {error}
        </div>
      )}

      {!loading && !error && data && (
        <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
          <div
            className="
              flex flex-wrap items-center justify-between gap-4
              border-b border-orange-100 px-5 py-4
            "
          >
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#F27123]">
                Học tập
              </p>

              <h1 className="mb-1 text-2xl font-bold text-[#0F2747]">
                Bài tập về nhà
              </h1>

              <p className="mb-0 text-sm text-slate-500">
                Theo dõi bài tập, hạn nộp và phản hồi từ giáo viên.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CompactStat
                icon={FiFileText}
                label="Tổng"
                value={summary.total}
                className="bg-slate-100 text-[#0F2747]"
              />

              <CompactStat
                icon={FiClock}
                label="Chưa nộp"
                value={summary.pending}
                className="bg-amber-50 text-amber-700"
              />

              <CompactStat
                icon={FiCheckCircle}
                label="Đã nộp"
                value={summary.submitted}
                className="bg-green-50 text-green-700"
              />

              <CompactStat
                icon={FiAlertCircle}
                label="Quá hạn"
                value={summary.overdue}
                className="bg-red-50 text-red-600"
              />
            </div>
          </div>

          <div className="space-y-4 bg-[#FFF9F4] p-5">
            {data.homeworks.length > 0 ? (
              data.homeworks.map((homework) => (
                <HomeworkCard
                  key={homework.homeworkId}
                  homework={homework}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Hiện chưa có bài tập về nhà.
              </div>
            )}
          </div>
        </section>
      )}
    </DashboardShell>
  );
}

export default StudentHomeworks;