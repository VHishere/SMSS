import { useMemo, useState } from "react";
import {
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiPlus,
    FiTarget,
    FiX,
    FiXCircle,
} from "react-icons/fi";

import { studentApi } from "../../api/client";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import StatusPill from "../../components/atoms/StatusPill";

import EmptyState from "../../components/molecules/EmptyState";

import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

import { useStudentSelfGoals } from "../../hooks/useStudentSelfGoals";
import { formatDate } from "../../utils/dateFormat";

const STATUS_LABEL = {
    IN_PROGRESS: "Đang thực hiện",
    COMPLETED: "Hoàn thành",
    FAILED: "Chưa đạt",
    ARCHIVED: "Lưu trữ",
};

const STATUS_TONE = {
    IN_PROGRESS: "blue",
    COMPLETED: "green",
    FAILED: "red",
    ARCHIVED: "slate",
};

function SummaryPill({
    icon: Icon,
    label,
    value,
    className,
}) {
    return (
        <div
            className={`
        inline-flex items-center gap-2
        rounded-full px-4 py-2
        text-sm font-bold
        ${className}
      `}
        >
            <Icon size={15} />

            <span>{label}</span>

            <span>{value}</span>
        </div>
    );
}

function GoalSummaryPills({
    total,
    inProgress,
    completed,
    failed,
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <SummaryPill
                icon={FiTarget}
                label="Tổng"
                value={total}
                className="bg-blue-50 text-[#08509F]"
            />

            <SummaryPill
                icon={FiClock}
                label="Đang làm"
                value={inProgress}
                className="bg-orange-50 text-[#C94F00]"
            />

            <SummaryPill
                icon={FiCheckCircle}
                label="Hoàn thành"
                value={completed}
                className="bg-green-50 text-green-700"
            />

            <SummaryPill
                icon={FiXCircle}
                label="Chưa đạt"
                value={failed}
                className="bg-red-50 text-red-600"
            />
        </div>
    );
}

function InlineFilterSelect({
    label,
    value,
    onChange,
    children,
}) {
    return (
        <label className="flex items-center gap-4">
            <span className="whitespace-nowrap text-sm font-medium mr-3 text-slate-500">
                {label}
            </span>

            <select
                value={value}
                onChange={onChange}
                className="
          h-11 min-w-[170px]
          rounded-xl border border-slate-200
          bg-white px-4 text-sm font-bold
          text-[#0F2747] shadow-sm
          outline-none transition
          hover:border-orange-200
          focus:border-[#F27123]
          focus:ring-4 focus:ring-orange-100
        "
            >
                {children}
            </select>
        </label>
    );
}

function toDateOnly(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
}

function getTargetDateStatus(targetDate) {
    const goalDate = toDateOnly(targetDate);

    if (!goalDate) {
        return {
            label: "Chưa có hạn",
            className: "border-slate-200 bg-slate-100 text-slate-500",
        };
    }

    const now = new Date();

    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    );

    if (goalDate.getTime() < today.getTime()) {
        return {
            label: "Quá hạn",
            className: "border-red-100 bg-red-50 text-red-600",
        };
    }

    if (goalDate.getTime() === today.getTime()) {
        return {
            label: "Đến hạn",
            className: "border-amber-100 bg-amber-50 text-amber-700",
        };
    }

    return {
        label: "Còn hạn",
        className: "border-green-100 bg-green-50 text-green-700",
    };
}

function GoalForm({
    types,
    onCreated,
    onCancel,
}) {
    const [form, setForm] = useState({
        goalType: types[0]?.key || "ACADEMIC",
        title: "",
        description: "",
        targetDate: "",
    });

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    function updateField(key, value) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        setSubmitting(true);
        setError("");

        try {
            await studentApi.createMyGoal(form);

            setForm({
                goalType: types[0]?.key || "ACADEMIC",
                title: "",
                description: "",
                targetDate: "",
            });

            onCreated();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
        >
            {error && (
                <div
                    className="
            rounded-2xl border border-red-200
            bg-red-50 px-4 py-3
            text-sm text-red-600
          "
                >
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <label
                        htmlFor="goal-type"
                        className="mb-2 block text-sm font-semibold text-slate-500"
                    >
                        Loại mục tiêu
                    </label>

                    <select
                        id="goal-type"
                        value={form.goalType}
                        onChange={(event) =>
                            updateField("goalType", event.target.value)
                        }
                        className="
              h-11 w-full rounded-2xl
              border border-slate-200
              bg-white px-4 text-sm font-bold
              text-[#0F2747] shadow-sm
              outline-none transition
              hover:border-orange-200
              focus:border-[#F27123]
              focus:ring-4 focus:ring-orange-100
            "
                    >
                        {types.length > 0 ? (
                            types.map((type) => (
                                <option
                                    key={type.key}
                                    value={type.key}
                                >
                                    {type.label}
                                </option>
                            ))
                        ) : (
                            <option value="ACADEMIC">
                                Học tập
                            </option>
                        )}
                    </select>
                </div>

                <div>
                    <label
                        htmlFor="goal-target-date"
                        className="mb-2 block text-sm font-semibold text-slate-500"
                    >
                        Ngày mục tiêu
                    </label>

                    <input
                        id="goal-target-date"
                        type="date"
                        value={form.targetDate}
                        onChange={(event) =>
                            updateField("targetDate", event.target.value)
                        }
                        className="
              h-11 w-full rounded-2xl
              border border-slate-200
              bg-white px-4 text-sm font-bold
              text-[#0F2747] shadow-sm
              outline-none transition
              hover:border-orange-200
              focus:border-[#F27123]
              focus:ring-4 focus:ring-orange-100
            "
                    />
                </div>
            </div>

            <div className="w-full">
                <label
                    htmlFor="goal-title"
                    className="mb-2 block text-sm font-semibold text-slate-500"
                >
                    Tiêu đề
                </label>

                <input
                    id="goal-title"
                    value={form.title}
                    onChange={(event) =>
                        updateField("title", event.target.value)
                    }
                    placeholder="Ví dụ: Đạt điểm trung bình Toán trên 8.5"
                    className="
            h-11 w-full rounded-2xl
            border border-slate-200
            bg-white px-4 text-sm font-bold
            text-[#0F2747] shadow-sm
            outline-none transition
            hover:border-orange-200
            focus:border-[#F27123]
            focus:ring-4 focus:ring-orange-100
          "
                />
            </div>

            <div className="w-full">
                <label
                    htmlFor="goal-description"
                    className="mb-2 block text-sm font-semibold text-slate-500"
                >
                    Mô tả
                </label>

                <textarea
                    id="goal-description"
                    value={form.description}
                    onChange={(event) =>
                        updateField("description", event.target.value)
                    }
                    rows={4}
                    placeholder="Mô tả cách thực hiện hoặc tiêu chí hoàn thành."
                    className="
            w-full resize-none rounded-2xl
            border border-slate-200
            bg-white px-4 py-3 text-sm
            text-[#0F2747] shadow-sm
            outline-none transition
            hover:border-orange-200
            focus:border-[#F27123]
            focus:ring-4 focus:ring-orange-100
          "
                />
            </div>

            <div className="flex justify-center gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        borderRadius: "9999px",
                    }}
                    className="
            h-11 min-w-[120px]
            border border-slate-200
            bg-white px-6 text-sm
            font-bold text-slate-600
            shadow-sm transition
            hover:bg-slate-50
          "
                >
                    Hủy
                </button>

                <button
                    type="submit"
                    disabled={submitting}
                    style={{
                        borderRadius: "9999px",
                    }}
                    className="
            h-11 min-w-[150px]
            bg-[#F27123] px-6
            text-sm font-bold text-white
            shadow-lg shadow-orange-200/70
            transition hover:-translate-y-0.5
            hover:bg-[#d95f17]
            hover:shadow-xl hover:shadow-orange-200
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
                >
                    {submitting ? "Đang tạo..." : "Tạo mục tiêu"}
                </button>
            </div>
        </form>
    );
}

function GoalCreateModal({
    open,
    types,
    onClose,
    onCreated,
}) {
    if (!open) {
        return null;
    }

    return (
        <div
            className="
        fixed inset-0 z-50 flex items-center
        justify-center bg-slate-900/40 px-4
        backdrop-blur-sm
      "
        >
            <div
                className="
          w-full max-w-2xl overflow-hidden
          rounded-[28px] bg-white shadow-2xl
        "
            >
                <div
                    className="
            flex items-start justify-between
            border-b border-orange-100
            px-7 py-6
          "
                >
                    <div>
                        <p
                            className="
                mb-2 text-xs font-bold uppercase
                tracking-[0.18em] text-[#F27123]
              "
                        >
                            Mục tiêu học sinh
                        </p>

                        <h2 className="mb-0 text-2xl font-bold text-[#0F2747]">
                            Thêm mục tiêu mới
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="
    -mt-2 text-5xl font-light
    leading-none text-slate-400
    transition hover:text-[#F27123]
  "
                    >
                        ×
                    </button>
                </div>

                <div className="px-7 py-6">
                    <GoalForm
                        types={types}
                        onCancel={onClose}
                        onCreated={onCreated}
                    />
                </div>
            </div>
        </div>
    );
}

function GoalCard({
    goal,
    typeLabel,
}) {
    const targetDateStatus = getTargetDateStatus(goal.targetDate);

    return (
        <article
            className="
        rounded-3xl border border-orange-100
        bg-white p-5 shadow-sm
        transition hover:-translate-y-0.5
        hover:shadow-md
      "
        >
            <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p
                        className="
              mb-2 text-xs font-bold uppercase
              tracking-[0.16em] text-[#F27123]
            "
                    >
                        {typeLabel}
                    </p>

                    <h3
                        className="
              mb-0 text-2xl font-bold
              leading-tight text-[#0F2747]
            "
                    >
                        {goal.title}
                    </h3>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusPill tone={STATUS_TONE[goal.status]}>
                        {STATUS_LABEL[goal.status] || goal.status}
                    </StatusPill>

                    <div
                        className={`
              inline-flex items-center gap-1.5
              rounded-full border px-3 py-1.5
              text-xs font-bold
              ${targetDateStatus.className}
            `}
                    >
                        <FiCalendar size={13} />

                        <span>
                            {targetDateStatus.label}
                        </span>

                        <span>
                            · {formatDate(goal.targetDate)}
                        </span>
                    </div>
                </div>
            </div>

            <div
                className="
          mb-4 rounded-2xl
          bg-[#FFF7F2] px-4 py-3
        "
            >
                <p
                    className="
            mb-1 text-xs font-semibold uppercase
            tracking-wide text-[#F27123]
          "
                >
                    Mô tả mục tiêu
                </p>

                <p className="mb-0 text-sm leading-6 text-slate-600">
                    {goal.description || "Chưa có mô tả."}
                </p>
            </div>

            {goal.teacherRemark && (
                <div className="mb-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-[#08509F]">
                    <span className="font-bold">GV nhận xét:</span>{" "}
                    {goal.teacherRemark}
                </div>
            )}

            {goal.finalComment && (
                <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
                    <span className="font-bold">Kết luận:</span>{" "}
                    {goal.finalComment}
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

    const {
        data,
        types,
        loading,
        error,
    } = useStudentSelfGoals(filters, refreshKey);

    const goals = data?.goals || [];

    const typeMap = useMemo(
        () =>
            Object.fromEntries(
                types.map((type) => [
                    type.key,
                    type.label,
                ]),
            ),
        [types],
    );

    const inProgressCount = goals.filter(
        (goal) => goal.status === "IN_PROGRESS",
    ).length;

    const completedCount = goals.filter(
        (goal) => goal.status === "COMPLETED",
    ).length;

    const failedCount = goals.filter(
        (goal) => goal.status === "FAILED",
    ).length;

    function refresh() {
        setRefreshKey((key) => key + 1);
    }

    function handleCreated() {
        setShowCreateModal(false);
        refresh();
    }

    return (
        <StudentDashboardShell context={data?.context}>
            <section
                className="
          mb-5 flex flex-wrap items-center
          justify-between gap-3
        "
            >
                <GoalSummaryPills
                    total={goals.length}
                    inProgress={inProgressCount}
                    completed={completedCount}
                    failed={failedCount}
                />

                <div className="flex flex-wrap items-center justify-end gap-6">
                    <InlineFilterSelect
                        label="Trạng thái"
                        value={filters.status}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                status: event.target.value,
                            }))
                        }
                    >
                        <option value="">Tất cả</option>
                        <option value="IN_PROGRESS">Đang thực hiện</option>
                        <option value="COMPLETED">Hoàn thành</option>
                        <option value="FAILED">Chưa đạt</option>
                    </InlineFilterSelect>

                    <InlineFilterSelect
                        label="Loại mục tiêu"
                        value={filters.goalType}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                goalType: event.target.value,
                            }))
                        }
                    >
                        <option value="">Tất cả</option>

                        {types.map((type) => (
                            <option
                                key={type.key}
                                value={type.key}
                            >
                                {type.label}
                            </option>
                        ))}
                    </InlineFilterSelect>

                    <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            borderRadius: "10px",
                        }}
                        className="
    inline-flex h-11 items-center gap-2
    bg-[#F27123]
    px-6 text-sm font-bold text-white
    shadow-lg shadow-orange-200/70
    transition hover:-translate-y-0.5
    hover:bg-[#d95f17]
    hover:shadow-xl hover:shadow-orange-200
  "
                    >
                        <FiPlus size={17} />
                        Thêm mục tiêu
                    </button>
                </div>
            </section>

            {loading && (
                <LoadingState label="Đang tải mục tiêu..." />
            )}

            {!loading && error && (
                <ErrorAlert error={`Không tải được mục tiêu: ${error}`} />
            )}

            {!loading && !error && data && (
                <>
                    {goals.length === 0 ? (
                        <EmptyState
                            title="Chưa có mục tiêu"
                            description="Tạo mục tiêu đầu tiên để bắt đầu theo dõi tiến độ."
                        />
                    ) : (
                        <section className="grid gap-4 xl:grid-cols-2">
                            {goals.map((goal) => (
                                <GoalCard
                                    key={goal.goalId}
                                    goal={goal}
                                    typeLabel={typeMap[goal.goalType] || goal.goalType}
                                />
                            ))}
                        </section>
                    )}

                    <GoalCreateModal
                        open={showCreateModal}
                        types={types}
                        onClose={() => setShowCreateModal(false)}
                        onCreated={handleCreated}
                    />
                </>
            )}
        </StudentDashboardShell>
    );
}

export default StudentGoals;