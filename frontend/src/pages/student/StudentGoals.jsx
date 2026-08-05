import { useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFlag,
  FiShield,
  FiTarget,
  FiUser,
} from "react-icons/fi";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useStudentSelfGoals } from "../../hooks/useStudentSelfGoals";
import PrettySelect from "../../components/molecules/PrettySelect";

const STATUS_META = {
  IN_PROGRESS: {
    label: "Đang thực hiện",
    className: "bg-emerald-50 text-emerald-700",
  },
  COMPLETED: {
    label: "Đã hoàn thành",
    className: "bg-blue-50 text-blue-700",
  },
  FAILED: {
    label: "Chưa đạt",
    className: "bg-red-50 text-red-600",
  },
  ARCHIVED: {
    label: "Đã lưu trữ",
    className: "bg-slate-100 text-slate-600",
  },
};

const TYPE_META = {
  ACADEMIC: {
    label: "Học tập",
    icon: FiBookOpen,
    iconClass: "bg-blue-50 text-[#0F4C8A]",
  },
  BEHAVIOUR: {
    label: "Hạnh kiểm",
    icon: FiShield,
    iconClass: "bg-orange-50 text-[#F27123]",
  },
  ATTENDANCE: {
    label: "Chuyên cần",
    icon: FiCalendar,
    iconClass: "bg-emerald-50 text-emerald-700",
  },
  PERSONAL: {
    label: "Phát triển cá nhân",
    icon: FiFlag,
    iconClass: "bg-violet-50 text-violet-700",
  },
};

function parseDate(value) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "Chưa đặt thời hạn";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDeadlineMeta(value) {
  const date = parseDate(value);

  if (!date) {
    return {
      label: "Chưa có hạn",
      className: "bg-slate-100 text-slate-500",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date.getTime() < today.getTime()) {
    return {
      label: "Kết thúc",
      className: "bg-red-50 text-red-600",
    };
  }

  if (date.getTime() === today.getTime()) {
    return {
      label: "Đến hạn hôm nay",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Đúng hạn",
    className: "bg-emerald-50 text-emerald-700",
  };
}

function GoalCard({ goal, typeLabel }) {
  const type = TYPE_META[goal.goalType] || {
    label: typeLabel || goal.goalType || "Mục tiêu",
    icon: FiTarget,
    iconClass: "bg-slate-100 text-slate-600",
  };
  const Icon = type.icon;
  const status = STATUS_META[goal.status] || {
    label: goal.status || "Chưa cập nhật",
    className: "bg-slate-100 text-slate-600",
  };
  const deadline = getDeadlineMeta(goal.targetDate);

  return (
    <article className="rounded-3xl border card-border bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:card-border hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${type.iconClass}`}>
          <Icon size={16} />
        </span>

        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[#F27123]">
        {typeLabel || type.label}
      </p>

      <h3 className="mb-1.5 line-clamp-2 text-sm font-extrabold leading-5 text-[#0F2747]">
        {goal.title}
      </h3>

      <p className="mb-3 line-clamp-2 min-h-[40px] text-xs leading-5 text-slate-500">
        {goal.description || "Mục tiêu chưa có mô tả chi tiết."}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <FiCalendar className="text-[#F27123]" />
          {formatDate(goal.targetDate)}
        </span>

        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${deadline.className}`}>
          {deadline.label}
        </span>
      </div>

      {goal.teacherRemark && (
        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2.5">
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-blue-600">
            Nhận xét giáo viên
          </p>
          <p className="mb-0 line-clamp-2 text-xs leading-5 text-blue-700">
            {goal.teacherRemark}
          </p>
        </div>
      )}
    </article>
  );
}

function StudentGoals() {
  const [filters, setFilters] = useState({
    status: "",
    goalType: "",
  });
  const { data, types, loading, error } = useStudentSelfGoals(filters);

  const goals = data?.goals || [];

  const typeMap = useMemo(
    () => Object.fromEntries(types.map((type) => [type.key, type.label])),
    [types],
  );

  const counts = useMemo(
    () => ({
      all: goals.length,
      inProgress: goals.filter((goal) => goal.status === "IN_PROGRESS").length,
      completed: goals.filter((goal) => goal.status === "COMPLETED").length,
      failed: goals.filter((goal) => goal.status === "FAILED").length,
    }),
    [goals],
  );

  const nearestGoals = useMemo(
    () =>
      goals
        .filter((goal) => goal.status === "IN_PROGRESS")
        .sort((first, second) => {
          const firstDate = parseDate(first.targetDate)?.getTime() || Number.MAX_SAFE_INTEGER;
          const secondDate = parseDate(second.targetDate)?.getTime() || Number.MAX_SAFE_INTEGER;
          return firstDate - secondDate;
        })
        .slice(0, 4),
    [goals],
  );

  const teacherRemarks = useMemo(
    () => goals.filter((goal) => goal.teacherRemark).slice(0, 2),
    [goals],
  );


  return (
    <StudentDashboardShell context={data?.context}>
      <section className="mb-5 overflow-hidden rounded-2xl bg-[#0F4C8A] px-5 py-5 text-white shadow-sm sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-white/70">
              Mục tiêu cá nhân
            </p>
            <h1 className="mb-2 text-2xl font-black sm:text-3xl">
              Lộ trình học tập của bạn
            </h1>
            <p className="mb-0 max-w-2xl text-sm leading-6 text-white/80">
              Xác định điều cần đạt, theo dõi thời hạn và tiếp nhận góp ý từ giáo viên.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-[220px]">
            <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="mb-0 text-[10px] font-bold uppercase tracking-wide text-white/65">
                Đang thực hiện
              </p>
              <strong className="text-2xl">{counts.inProgress}</strong>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="mb-0 text-[10px] font-bold uppercase tracking-wide text-white/65">
                Hoàn thành
              </p>
              <strong className="text-2xl">{counts.completed}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4 flex flex-col gap-3 rounded-3xl border card-border bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                goalType: "",
              }))
            }
            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-bold transition ${
              filters.goalType === ""
                ? "bg-white text-[#F27123] shadow-sm"
                : "text-slate-500 hover:text-[#0F2747]"
            }`}
          >
            Tất cả
          </button>

          {types.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  goalType: type.key,
                }))
              }
              className={`shrink-0 rounded-lg px-4 py-2 text-xs font-bold transition ${
                filters.goalType === type.key
                  ? "bg-white text-[#F27123] shadow-sm"
                  : "text-slate-500 hover:text-[#0F2747]"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <PrettySelect
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: event.target.value,
            }))
          }
          className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-[#0F2747] outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="IN_PROGRESS">Đang thực hiện</option>
          <option value="COMPLETED">Đã hoàn thành</option>
          <option value="FAILED">Chưa đạt</option>
        </PrettySelect>
      </section>

      {loading && <LoadingState label="Đang tải danh sách mục tiêu..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được mục tiêu: ${error}`} />
      )}

      {!loading && !error && data && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="mb-1 text-base font-extrabold text-[#0F2747]">
                  Mục tiêu của tôi
                </h2>
                <p className="mb-0 text-xs text-slate-500">
                  Các mục tiêu được hiển thị trực tiếp, không có trang chi tiết riêng.
                </p>
              </div>

              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#F27123]">
                {counts.all} mục tiêu
              </span>
            </div>

            {goals.length === 0 ? (
              <EmptyState
                title="Chưa có mục tiêu phù hợp"
                description="Thử đổi bộ lọc để xem các mục tiêu khác."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {goals.map((goal) => (
                  <GoalCard
                    key={goal.goalId}
                    goal={goal}
                    typeLabel={typeMap[goal.goalType]}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4 xl:sticky xl:top-5">
            <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                <FiTarget className="text-[#F27123]" />
                Kế hoạch sắp tới
              </h2>

              {nearestGoals.length === 0 ? (
                <p className="mb-0 rounded-xl bg-slate-50 px-4 py-5 text-center text-xs leading-5 text-slate-500">
                  Không có mục tiêu đang thực hiện.
                </p>
              ) : (
                <div className="space-y-4">
                  {nearestGoals.map((goal, index) => (
                    <div key={goal.goalId} className="flex items-start gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0F4C8A] text-[10px] font-extrabold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="mb-1 line-clamp-2 text-xs font-extrabold leading-5 text-[#0F2747]">
                          {goal.title}
                        </p>
                        <p className="mb-0 inline-flex items-center gap-1 text-[10px] text-slate-500">
                          <FiClock className="text-[#F27123]" />
                          {formatDate(goal.targetDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                <FiUser className="text-[#F27123]" />
                Phản hồi giáo viên
              </h2>

              {teacherRemarks.length === 0 ? (
                <p className="mb-0 rounded-xl bg-slate-50 px-4 py-5 text-center text-xs leading-5 text-slate-500">
                  Chưa có nhận xét từ giáo viên.
                </p>
              ) : (
                <div className="space-y-3">
                  {teacherRemarks.map((goal) => (
                    <div key={goal.goalId} className="rounded-xl bg-blue-50 px-4 py-3">
                      <p className="mb-1 line-clamp-1 text-xs font-extrabold text-blue-800">
                        {goal.title}
                      </p>
                      <p className="mb-0 line-clamp-3 text-xs leading-5 text-blue-700">
                        {goal.teacherRemark}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                <FiCheckCircle className="text-emerald-600" />
                Tổng quan
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <strong className="block text-xl text-emerald-700">
                    {counts.completed}
                  </strong>
                  <span className="text-[10px] font-bold text-emerald-700">
                    Hoàn thành
                  </span>
                </div>

                <div className="rounded-xl bg-red-50 p-3 text-center">
                  <strong className="block text-xl text-red-600">
                    {counts.failed}
                  </strong>
                  <span className="text-[10px] font-bold text-red-600">
                    Chưa đạt
                  </span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}
    </StudentDashboardShell>
  );
}

export default StudentGoals;