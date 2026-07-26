import { useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFlag,
  FiPlus,
  FiShield,
  FiTarget,
  FiUser,
  FiX,
} from "react-icons/fi";

import { studentApi } from "../../api/client";
import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useStudentSelfGoals } from "../../hooks/useStudentSelfGoals";

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

function GoalCreateModal({ types, onClose, onCreated }) {
  const [form, setForm] = useState({
    goalType: types[0]?.key || "ACADEMIC",
    title: "",
    description: "",
    targetDate: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await studentApi.createMyGoal(form);
      onCreated();
    } catch (requestError) {
      setError(requestError.message || "Không thể tạo mục tiêu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="
        fixed inset-0 z-[80] flex items-center justify-center
        bg-slate-950/50 px-4 py-2 backdrop-blur-sm
      "
    >
      <button
        type="button"
        aria-label="Đóng hộp thoại"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="
          relative z-10 max-h-[calc(100vh-48px)] w-full max-w-2xl
          overflow-y-auto rounded-3xl border border-slate-200
          bg-white shadow-2xl
        "
      >
        {/* Header */}
        <div
          className="
            flex items-start justify-between gap-4
            border-b border-slate-100 px-6 py-3 sm:px-7
          "
        >
          <div className="flex min-w-0 items-start gap-4">
            <span
              className="
                grid h-12 w-12 shrink-0 place-items-center
                rounded-2xl bg-orange-50 text-[#F27123]
              "
            >
              <FiTarget size={22} />
            </span>

            <div className="min-w-0">
              <h2 className="mb-1 text-xl font-black text-[#0F2747] sm:text-2xl">
                Thiết lập mục tiêu mới
              </h2>
              <p className="mb-0 text-sm leading-6 text-slate-500">
                Tạo mục tiêu rõ ràng để theo dõi trong học kỳ.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="
              grid h-10 w-10 shrink-0 place-items-center rounded-full
              bg-slate-50 text-slate-400 transition
              hover:bg-slate-100 hover:text-slate-700
            "
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-3 sm:px-7">
          {error && (
            <p
              className="
                mb-5 rounded-xl border border-red-100 bg-red-50
                px-4 py-3 text-sm font-medium text-red-600
              "
            >
              {error}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Loại mục tiêu */}
            <div className="min-w-0">
              <label
                htmlFor="goal-type"
                className=" block text-sm font-extrabold text-[#0F2747]"
              >
                Loại mục tiêu
              </label>

              <div className="relative">
                <FiBookOpen
                  className="
                    pointer-events-none absolute left-3.5 top-1/2
                    -translate-y-1/2 text-[#0F4C8A]
                  "
                  size={16}
                />

                <select
                  id="goal-type"
                  value={form.goalType}
                  onChange={(event) =>
                    updateField("goalType", event.target.value)
                  }
                  className="
                    h-12 w-full cursor-pointer rounded-xl
                    border border-slate-200 bg-slate-50
                    pl-10 pr-10 text-sm font-semibold text-slate-700
                    outline-none transition
                    hover:border-slate-300 hover:bg-white
                    focus:border-orange-300 focus:bg-white
                    focus:ring-2 focus:ring-orange-100
                  "
                >
                  {types.map((type) => (
                    <option key={type.key} value={type.key}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Thời hạn */}
            <div className="min-w-0">
              <label
                htmlFor="goal-deadline"
                className=" block text-sm font-extrabold text-[#0F2747]"
              >
                Thời hạn
              </label>

              <div className="relative">
                <FiCalendar
                  className="
                    pointer-events-none absolute left-3.5 top-1/2
                    -translate-y-1/2 text-[#F27123]
                  "
                  size={16}
                />

                <input
                  id="goal-deadline"
                  type="date"
                  value={form.targetDate}
                  onChange={(event) =>
                    updateField("targetDate", event.target.value)
                  }
                  className="
                    h-12 w-full rounded-xl border border-slate-200
                    bg-slate-50 pl-10 pr-3 text-sm font-semibold
                    text-slate-700 outline-none transition
                    hover:border-slate-300 hover:bg-white
                    focus:border-orange-300 focus:bg-white
                    focus:ring-2 focus:ring-orange-100
                  "
                />
              </div>
            </div>

            {/* Tên mục tiêu */}
            <div className="min-w-0 sm:col-span-2">
              <label
                htmlFor="goal-title"
                className="mb-2 block text-sm font-extrabold text-[#0F2747]"
              >
                Tên mục tiêu
                <span className="ml-1 text-red-500">*</span>
              </label>

              <div className="relative">
                <FiFlag
                  className="
                    pointer-events-none absolute left-3.5 top-1/2
                    -translate-y-1/2 text-[#F27123]
                  "
                  size={16}
                />

                <input
                  id="goal-title"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(event) =>
                    updateField("title", event.target.value)
                  }
                  placeholder="Ví dụ: Đạt điểm Toán trên 8.5"
                  className="
                    h-12 w-full rounded-xl border border-slate-200
                    bg-slate-50 pl-10 pr-4 text-sm text-slate-700
                    outline-none transition placeholder:text-slate-400
                    hover:border-slate-300 hover:bg-white
                    focus:border-orange-300 focus:bg-white
                    focus:ring-2 focus:ring-orange-100
                  "
                />
              </div>

              <p className="mb-0 mt-1.5 text-xs text-slate-400">
                Nên đặt tên ngắn gọn, cụ thể và có thể đo lường.
              </p>
            </div>

            {/* Mô tả */}
            <div className="min-w-0 sm:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="goal-description"
                  className="block text-sm font-extrabold text-[#0F2747]"
                >
                  Mô tả
                </label>

                <span className="text-xs text-slate-400">
                  {form.description.length}/500
                </span>
              </div>

              <textarea
                id="goal-description"
                rows={5}
                maxLength={500}
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Mô tả nội dung, kế hoạch thực hiện và kết quả bạn muốn đạt được..."
                className="
                  min-h-[130px] w-full resize-y rounded-xl
                  border border-slate-200 bg-slate-50
                  px-4 py-3 text-sm leading-6 text-slate-700
                  outline-none transition placeholder:text-slate-400
                  hover:border-slate-300 hover:bg-white
                  focus:border-orange-300 focus:bg-white
                  focus:ring-2 focus:ring-orange-100
                "
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="
            flex flex-col-reverse gap-3 border-t border-slate-100
            bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end sm:px-7
          "
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="
              h-11 rounded-xl border border-slate-200 bg-white
              px-6 text-sm font-bold text-slate-600 transition
              hover:border-slate-300 hover:bg-slate-50
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            Hủy
          </button>

          <button
            type="submit"
            disabled={submitting || !form.title.trim()}
            className="
              inline-flex h-11 items-center justify-center gap-2
              rounded-xl bg-[#F27123] px-7
              text-sm font-extrabold text-white shadow-sm transition
              hover:-translate-y-0.5 hover:bg-[#d95f17]
              disabled:cursor-not-allowed disabled:bg-slate-300
              disabled:shadow-none
            "
          >
            <FiPlus size={17} />
            {submitting ? "Đang tạo mục tiêu..." : "Tạo mục tiêu"}
          </button>
        </div>
      </form>
    </div>
  );
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
    <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, types, loading, error } = useStudentSelfGoals(
    filters,
    refreshKey,
  );

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

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  function handleCreated() {
    setShowCreateModal(false);
    refresh();
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

      <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
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

        <select
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
        </select>
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
                description="Thử đổi bộ lọc hoặc tạo một mục tiêu mới."
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

                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="flex min-h-[210px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center transition hover:border-orange-300 hover:bg-orange-50/40"
                >
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-[#0F4C8A]">
                    <FiPlus />
                  </span>
                  <strong className="text-sm text-[#0F2747]">
                    Thêm mục tiêu mới
                  </strong>
                  <span className="mt-1 text-xs text-slate-500">
                    Thiết lập mục tiêu cho học tập hoặc rèn luyện.
                  </span>
                </button>
              </div>
            )}
          </section>

          <aside className="space-y-4 xl:sticky xl:top-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

      {showCreateModal && (
        <GoalCreateModal
          types={types.length ? types : Object.entries(TYPE_META).map(([key, value]) => ({
            key,
            label: value.label,
          }))}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </StudentDashboardShell>
  );
}

export default StudentGoals;