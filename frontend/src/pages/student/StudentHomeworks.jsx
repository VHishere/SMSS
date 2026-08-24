import { useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiCode,
  FiDatabase,
  FiFileText,
  FiFilter,
} from "react-icons/fi";
import { Link, useSearchParams } from "react-router-dom";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useStudentHomeworks } from "../../hooks/useStudentHomeworks";
import PrettySelect from "../../components/molecules/PrettySelect";

function parseDate(value) {
  if (!value) return null;

  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getHomeworkStatus(homework) {
  if (homework.submissionStatus === "GRADED") {
    return {
      key: "submitted",
      label: "Đã chấm điểm",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (homework.studentHomeworkStatus === "SUBMITTED") {
    return {
      key: "submitted",
      label: "Đã nộp",
      className: "bg-blue-50 text-blue-700",
    };
  }

  if (homework.studentHomeworkStatus === "OVERDUE") {
    return {
      key: "overdue",
      label: "Quá hạn",
      className: "bg-red-50 text-red-600",
    };
  }

  return {
    key: "pending",
    label: "Chưa nộp",
    className: "bg-orange-50 text-[#F27123]",
  };
}

function getSubjectVisual(subjectName = "") {
  const normalized = subjectName.toLowerCase();

  if (normalized.includes("tin") || normalized.includes("lập trình")) {
    return {
      icon: FiCode,
      className: "bg-blue-100 text-blue-600",
    };
  }

  if (normalized.includes("cơ sở dữ liệu")) {
    return {
      icon: FiDatabase,
      className: "bg-violet-100 text-violet-600",
    };
  }

  if (
    normalized.includes("vật lý") ||
    normalized.includes("hóa") ||
    normalized.includes("sinh")
  ) {
    return {
      icon: FiActivity,
      className: "bg-cyan-100 text-cyan-700",
    };
  }

  if (
    normalized.includes("văn") ||
    normalized.includes("anh") ||
    normalized.includes("ngôn ngữ")
  ) {
    return {
      icon: FiFileText,
      className: "bg-orange-100 text-[#F27123]",
    };
  }

  return {
    icon: FiBookOpen,
    className: "bg-slate-100 text-slate-600",
  };
}

function HomeworkCard({ homework }) {
  const status = getHomeworkStatus(homework);
  const visual = getSubjectVisual(homework.subjectName);
  const Icon = visual.icon;
  const isGraded = homework.submissionStatus === "GRADED";

  return (
    <Link
      to={`/student/homeworks/${homework.homeworkId}`}
      className="
        group block rounded-3xl border card-border bg-white
        p-4 text-inherit no-underline shadow-sm transition
        hover:-translate-y-0.5 hover:card-border hover:shadow-md
      "
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span
          className={`
            grid h-12 w-12 shrink-0 place-items-center rounded-xl
            ${visual.className}
          `}
        >
          <Icon size={21} />
        </span>

        <div className="min-w-0 flex-1">
          <h3
            className="
              mb-1 truncate text-sm font-extrabold text-[#0F2747]
              transition group-hover:text-[#F27123]
            "
          >
            {homework.title}
          </h3>

          <p className="mb-1 truncate text-[11px] text-slate-500">
            Môn học:{" "}
            <span className="font-semibold text-slate-700">
              {homework.subjectName}
            </span>
            {homework.teacherName
              ? ` · Giáo viên: ${homework.teacherName}`
              : ""}
          </p>

          <div
            className="
              flex flex-wrap items-center gap-x-4 gap-y-1
              text-[10px] text-slate-500
            "
          >
            <span className="inline-flex items-center gap-1.5">
              <FiClock className="text-[#F27123]" />
              Hạn chót: {formatDateTime(homework.dueDate)}
            </span>

            {homework.fileUrl && (
              <span className="inline-flex items-center gap-1.5">
                <FiFileText className="text-[#0F4C8A]" />
                Có tệp bài đã nộp
              </span>
            )}
          </div>
        </div>

        <div
          className="
            flex shrink-0 items-center justify-between gap-4
            border-t border-slate-100 pt-3
            sm:min-w-[155px] sm:flex-col sm:items-end
            sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0
          "
        >
          <span
            className={`
              rounded-full px-2.5 py-1 text-[10px] font-bold
              ${status.className}
            `}
          >
            {status.label}
          </span>

          {isGraded ? (
            <div className="text-right">
              <strong className="text-lg leading-none text-[#0F4C8A]">
                {homework.score ?? "-"}
              </strong>
              <span className="text-[10px] text-slate-400"> / 10</span>
            </div>
          ) : (
            <span
              className="
                inline-flex h-8 items-center justify-center rounded-xl
                bg-[#C25700] px-4 text-[11px] font-extrabold text-white
                transition group-hover:bg-[#F27123]
              "
            >
              {status.key === "submitted" ? "Xem bài nộp" : "Nộp bài"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function StudentHomeworks() {
  const { data, loading, error } = useStudentHomeworks();
  const [searchParams] = useSearchParams();
  // Từ khóa từ ?search= (ô tìm kiếm header) — lọc theo tên bài tập / môn học.
  const searchKw = (searchParams.get("search") ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

  const [activeTab, setActiveTab] = useState("all");
  const [subjectId, setSubjectId] = useState("all");

  const homeworks = data?.homeworks || [];

  const subjectOptions = useMemo(() => {
    const map = new Map();

    homeworks.forEach((homework) => {
      if (homework.subjectId && homework.subjectName) {
        map.set(String(homework.subjectId), homework.subjectName);
      }
    });

    return Array.from(map, ([value, label]) => ({
      value,
      label,
    })).sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [homeworks]);

  const subjectFilteredHomeworks = useMemo(() => {
    const norm = (s) =>
      String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return homeworks.filter((homework) => {
      if (subjectId !== "all" && String(homework.subjectId) !== subjectId) {
        return false;
      }
      if (
        searchKw &&
        !norm(homework.title).includes(searchKw) &&
        !norm(homework.subjectName).includes(searchKw)
      ) {
        return false;
      }
      return true;
    });
  }, [homeworks, subjectId, searchKw]);

  const summary = useMemo(() => {
    return subjectFilteredHomeworks.reduce(
      (result, homework) => {
        const key = getHomeworkStatus(homework).key;

        result.all += 1;
        result[key] += 1;

        return result;
      },
      {
        all: 0,
        pending: 0,
        submitted: 0,
        overdue: 0,
      },
    );
  }, [subjectFilteredHomeworks]);

  const displayedHomeworks = useMemo(() => {
    if (activeTab === "all") {
      return subjectFilteredHomeworks;
    }

    return subjectFilteredHomeworks.filter(
      (homework) => getHomeworkStatus(homework).key === activeTab,
    );
  }, [activeTab, subjectFilteredHomeworks]);

  const tabs = [
    {
      key: "all",
      label: "Tất cả",
      count: summary.all,
    },
    {
      key: "pending",
      label: "Đang diễn ra",
      count: summary.pending,
    },
    {
      key: "submitted",
      label: "Đã nộp",
      count: summary.submitted,
    },
    {
      key: "overdue",
      label: "Quá hạn",
      count: summary.overdue,
    },
  ];

  return (
    <StudentDashboardShell context={data?.context}>
      <section className="mb-4">

        <div
          className="
            flex flex-col gap-4
            md:flex-row md:items-end md:justify-between
          "
        >
          <div>
            <h1 className="mb-1 text-xl font-black text-[#0F2747]">
              Danh sách bài tập
            </h1>
          </div>

          <div
            className="
              flex w-full items-center gap-3 rounded-3xl
              border card-border bg-white p-2.5 shadow-sm
              transition focus-within:card-border
              focus-within:ring-2 focus-within:ring-orange-100
              md:w-auto
            "
          >
            <span
              className="
                grid h-9 w-9 shrink-0 place-items-center
                rounded-xl bg-orange-50 text-[#F27123]
              "
            >
              <FiFilter size={16} />
            </span>

            <label className="min-w-0 flex-1">
              <span
                className="
                  mb-0.5 block text-[9px] font-extrabold uppercase
                  tracking-wide text-slate-400
                "
              >
                Lọc theo môn học
              </span>

              <PrettySelect
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="
                  h-7 w-full min-w-[190px] cursor-pointer
                  border-0 bg-transparent p-0 pr-8 text-xs
                  font-bold text-[#0F2747] outline-none
                "
              >
                <option value="all">Tất cả môn học</option>

                {subjectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </PrettySelect>
            </label>
          </div>
        </div>
      </section>

      {loading && <LoadingState label="Đang tải danh sách bài tập..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được bài tập về nhà: ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          <nav
            className="
              mb-5 grid grid-cols-2 gap-1 rounded-2xl
              border border-slate-200 bg-slate-100 p-1
              sm:grid-cols-4
            "
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    flex min-h-11 items-center justify-center gap-1.5
                    rounded-xl px-4 py-2.5 text-xs font-extrabold
                    transition
                    ${
                      isActive
                        ? "bg-white text-[#F27123] shadow-sm"
                        : "text-slate-500 hover:bg-white/60 hover:text-[#0F2747]"
                    }
                  `}
                >
                  <span>{tab.label}</span>

                  <span
                    className={`
                      rounded-full px-2 py-0.5 text-[10px]
                      ${
                        isActive
                          ? "bg-orange-50 text-[#F27123]"
                          : "bg-slate-200 text-slate-500"
                      }
                    `}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="space-y-3">
            {displayedHomeworks.length > 0 ? (
              displayedHomeworks.map((homework) => (
                <HomeworkCard
                  key={homework.homeworkId}
                  homework={homework}
                />
              ))
            ) : (
              <EmptyState
                title="Không có bài tập phù hợp"
                description="Thử đổi trạng thái hoặc môn học đang lọc."
              />
            )}
          </section>

          <div className="mt-5 flex justify-center">
            <span
              className="
                inline-flex items-center gap-2 rounded-full
                border border-slate-200 bg-white px-4 py-2
                text-[11px] font-semibold text-slate-500 shadow-sm
              "
            >
              {activeTab === "all" && <FiBookOpen />}
              {activeTab === "pending" && <FiClock />}
              {activeTab === "submitted" && <FiCheckCircle />}
              {activeTab === "overdue" && <FiAlertCircle />}

              Đang hiển thị {displayedHomeworks.length} bài tập
            </span>
          </div>
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentHomeworks;