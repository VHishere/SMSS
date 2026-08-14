import { useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiEdit3,
  FiFlag,
  FiMessageCircle,
  FiPlus,
  FiShield,
  FiTarget,
  FiUser,
} from "react-icons/fi";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentGoalFormModal from "../../components/organisms/StudentGoalFormModal";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useStudentSelfGoals } from "../../hooks/useStudentSelfGoals";

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

function isOverdue(value) {
  const date = parseDate(value);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
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
      label: "Đã qua hạn",
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
    label: "Còn thời gian",
    className: "bg-emerald-50 text-emerald-700",
  };
}

function GoalCard({ goal, typeLabel, onEdit }) {
  const type = TYPE_META[goal.goalType] || {
    label: typeLabel || goal.goalType || "Mục tiêu",
    icon: FiTarget,
    iconClass: "bg-slate-100 text-slate-600",
  };
  const Icon = type.icon;
  const deadline = getDeadlineMeta(goal.targetDate);

  return (
    <article className="rounded-3xl border card-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${type.iconClass}`}>
          <Icon size={17} />
        </span>

        <button
          type="button"
          onClick={() => onEdit(goal)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F27123]"
        >
          <FiEdit3 size={12} />
          Chỉnh sửa
        </button>
      </div>

      <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[#F27123]">
        {typeLabel || type.label}
      </p>

      <h3 className="mb-1.5 line-clamp-2 text-sm font-extrabold leading-5 text-[#0F2747]">
        {goal.title}
      </h3>

      <p className="mb-3 min-h-[40px] text-xs leading-5 text-slate-500">
        {goal.description || "Mục tiêu chưa có mô tả chi tiết."}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
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
          <p className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-blue-600">
            <FiMessageCircle />
            Nhận xét GVCN
          </p>
          <p className="mb-0 text-xs leading-5 text-blue-700">
            {goal.teacherRemark}
          </p>
        </div>
      )}
    </article>
  );
}

function StudentGoals() {
  const [filters, setFilters] = useState({ goalType: "" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [formState, setFormState] = useState(null);

  const { data, types, loading, error } = useStudentSelfGoals(filters, refreshKey);
  const goals = data?.goals || [];

  const typeMap = useMemo(
    () => Object.fromEntries(types.map((type) => [type.key, type.label])),
    [types],
  );

  const counts = useMemo(
    () => ({
      all: goals.length,
      withRemark: goals.filter((goal) => Boolean(goal.teacherRemark)).length,
      overdue: goals.filter((goal) => isOverdue(goal.targetDate)).length,
      upcoming: goals.filter((goal) => !isOverdue(goal.targetDate)).length,
    }),
    [goals],
  );

  const nearestGoals = useMemo(
    () =>
      [...goals]
        .filter((goal) => !isOverdue(goal.targetDate))
        .sort((first, second) => {
          const firstDate = parseDate(first.targetDate)?.getTime() || Number.MAX_SAFE_INTEGER;
          const secondDate = parseDate(second.targetDate)?.getTime() || Number.MAX_SAFE_INTEGER;
          return firstDate - secondDate;
        })
        .slice(0, 4),
    [goals],
  );

  const teacherRemarks = useMemo(
    () => goals.filter((goal) => goal.teacherRemark).slice(0, 3),
    [goals],
  );

  function openCreate() {
    setFormState({ mode: "create", goal: null });
  }

  function openEdit(goal) {
    setFormState({ mode: "edit", goal });
  }

  function handleSaved() {
    setFormState(null);
    setRefreshKey((current) => current + 1);
  }

  return (
    <StudentDashboardShell context={data?.context}>
      <section className="mb-5 overflow-hidden rounded-2xl bg-[#0F4C8A] px-5 py-5 text-white shadow-sm sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-white/70">
              Mục tiêu cá nhân
            </p>
            <h1 className="mb-2 text-2xl font-black sm:text-3xl">
              Mục tiêu của bạn
            </h1>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-[250px]">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F27123] px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#d85f18]"
            >
              <FiPlus size={18} />
              Tạo mục tiêu mới
            </button>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/10 px-3 py-3 text-center backdrop-blur-sm">
                <strong className="block text-2xl">{counts.all}</strong>
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/65">
                  Tổng mục tiêu
                </span>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-3 text-center backdrop-blur-sm">
                <strong className="block text-2xl">{counts.withRemark}</strong>
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/65">
                  Có nhận xét
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4 flex flex-col gap-3 rounded-3xl border card-border bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setFilters({ goalType: "" })}
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
              onClick={() => setFilters({ goalType: type.key })}
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
              </div>

              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#F27123]">
                {counts.all} mục tiêu
              </span>
            </div>

            {goals.length === 0 ? (
              <EmptyState
                title="Chưa có mục tiêu"
                description="Tạo mục tiêu đầu tiên để bắt đầu lên kế hoạch cho bản thân."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {goals.map((goal) => (
                  <GoalCard
                    key={goal.goalId}
                    goal={goal}
                    typeLabel={typeMap[goal.goalType]}
                    onEdit={openEdit}
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
                  Chưa có mục tiêu nào sắp tới.
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
                Nhận xét GVCN
              </h2>

              {teacherRemarks.length === 0 ? (
                <p className="mb-0 rounded-xl bg-slate-50 px-4 py-5 text-center text-xs leading-5 text-slate-500">
                  Chưa có nhận xét từ giáo viên chủ nhiệm.
                </p>
              ) : (
                <div className="space-y-3">
                  {teacherRemarks.map((goal) => (
                    <div key={goal.goalId} className="rounded-xl bg-blue-50 px-4 py-3">
                      <p className="mb-1 line-clamp-1 text-xs font-extrabold text-blue-800">
                        {goal.title}
                      </p>
                      <p className="mb-0 text-xs leading-5 text-blue-700">
                        {goal.teacherRemark}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                <FiCalendar className="text-[#F27123]" />
                Thời hạn
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <strong className="block text-xl text-emerald-700">
                    {counts.upcoming}
                  </strong>
                  <span className="text-[10px] font-bold text-emerald-700">
                    Còn thời gian
                  </span>
                </div>

                <div className="rounded-xl bg-red-50 p-3 text-center">
                  <strong className="block text-xl text-red-600">
                    {counts.overdue}
                  </strong>
                  <span className="text-[10px] font-bold text-red-600">
                    Đã qua hạn
                  </span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}

      {formState && (
        <StudentGoalFormModal
          mode={formState.mode}
          goal={formState.goal}
          goalTypes={types}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}
    </StudentDashboardShell>
  );
}

export default StudentGoals;
