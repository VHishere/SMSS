import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiMessageCircle,
  FiUser,
} from "react-icons/fi";
import { Link, useParams } from "react-router-dom";

import { studentApi } from "../../api/client";
import ErrorAlert from "../../components/atoms/ErrorAlert";
import FilePreviewLink from "../../components/atoms/FilePreviewLink";
import LoadingState from "../../components/atoms/LoadingState";
import HomeworkAttachmentList from "../../components/molecules/HomeworkAttachmentList";
import StudentHomeworkSubmitPanel from "../../components/organisms/StudentHomeworkSubmitPanel";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

function parseDate(value) {
  if (!value) return null;

  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

function isPastDue(dueDate) {
  const due = parseDate(dueDate);
  return Boolean(due && due.getTime() <= Date.now());
}

function formatTimeRemaining(dueDate) {
  const due = parseDate(dueDate);
  if (!due) return "Chưa cập nhật";

  const difference = due.getTime() - Date.now();

  if (difference <= 0) {
    return "Đã hết hạn";
  }

  const hours = Math.ceil(difference / (1000 * 60 * 60));

  if (hours < 24) {
    return `Còn ${hours} giờ`;
  }

  return `Còn ${Math.ceil(hours / 24)} ngày`;
}

function getHomeworkStatus(homework) {
  if (homework?.submissionStatus === "GRADED") {
    return {
      label: "Đã chấm",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (homework?.submissionStatus === "SUBMITTED") {
    return {
      label: "Đã nộp",
      className: "bg-blue-50 text-blue-700",
    };
  }

  if (homework?.submissionStatus === "LATE" || homework?.isLate) {
    return {
      label: "Nộp muộn",
      className: "bg-red-50 text-red-600",
    };
  }

  if (homework?.isOverdue || isPastDue(homework?.dueDate)) {
    return {
      label: "Quá hạn",
      className: "bg-red-50 text-red-600",
    };
  }

  return {
    label: "Chưa nộp",
    className: "bg-orange-50 text-[#F27123]",
  };
}

function getSubmitDisabledReason(homework) {
  if (!homework) return "";

  if (homework.submissionStatus === "GRADED") {
    return "Bài nộp đã được giáo viên chấm điểm nên bạn không thể cập nhật bài.";
  }

  if (homework.isOverdue || isPastDue(homework.dueDate)) {
    return "Bài tập đã quá hạn nộp nên bạn không thể nộp hoặc cập nhật bài.";
  }

  if (homework.status !== "OPEN") {
    return "Giáo viên đã đóng bài tập nên bạn không thể nộp hoặc cập nhật bài.";
  }

  return "";
}

function SubmissionOverview({ homework, status }) {
  const overdue = homework.isOverdue || isPastDue(homework.dueDate);

  return (
    <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
      <h3 className="mb-5 text-xl font-black text-[#0F2747]">
        Trạng thái nộp bài
      </h3>

      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium text-slate-500">Trạng thái</span>

          <span
            className={`
              rounded-full px-3 py-1.5 text-xs font-extrabold
              ${status.className}
            `}
          >
            {status.label}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="font-medium text-slate-500">Điểm số</span>

          <strong className="text-base text-[#0F2747]">
            {homework.score ?? "-"} / {homework.maxScore || 10}
          </strong>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="font-medium text-slate-500">
            Thời gian còn lại
          </span>

          <strong
            className={`text-sm ${
              overdue ? "text-red-600" : "text-[#F27123]"
            }`}
          >
            {formatTimeRemaining(homework.dueDate)}
          </strong>
        </div>
      </div>

      {homework.submissionId && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">
            Bài đã nộp
          </p>

          <p className="mb-3 text-sm text-slate-500">
            Nộp lúc: {formatDateTime(homework.submitTime)}
          </p>

          {homework.submissionFileUrl && (
            <FilePreviewLink
              fileName="Tệp bài làm đã nộp"
              fileUrl={homework.submissionFileUrl}
            />
          )}

          {homework.submissionContent && (
            <a
              href={homework.submissionContent}
              target="_blank"
              rel="noreferrer"
              className="
                mt-2 flex items-center gap-2 truncate rounded-xl
                bg-slate-50 px-3 py-3 text-sm font-semibold
                text-[#0F4C8A] no-underline hover:bg-blue-50
              "
            >
              <FiFileText className="shrink-0" />
              <span className="truncate">
                {homework.submissionContent}
              </span>
            </a>
          )}
        </div>
      )}
    </section>
  );
}

function TeacherFeedback({ homework }) {
  const feedback = homework.feedback?.trim();
  const initial =
    homework.teacherName?.trim()?.charAt(0)?.toUpperCase() || "G";

  return (
    <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-[#0F2747]">
        <FiMessageCircle className="text-[#F27123]" />
        Trao đổi
      </h3>

      {!feedback ? (
        <div className="rounded-xl bg-slate-50 px-4 py-5">
          <p className="mb-0 text-sm leading-6 text-slate-500">
            Chưa có nhận xét từ giáo viên.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span
            className="
              grid h-10 w-10 shrink-0 place-items-center
              rounded-full bg-[#0F4C8A]
              text-sm font-extrabold text-white
            "
          >
            {initial}
          </span>

          <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-4 py-3">
            <p className="mb-1 text-sm font-extrabold text-[#0F2747]">
              {homework.teacherName || "Giáo viên"}
            </p>

            <p className="mb-0 whitespace-pre-line text-sm leading-6 text-slate-500">
              {feedback}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function StudentHomeworkDetail() {
  const { homeworkId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadDetail() {
    setLoading(true);
    setError("");

    try {
      const response = await studentApi.getMyHomeworkDetail(homeworkId);
      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.message || "Không thể tải chi tiết bài tập.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeworkId]);

  const homework = data?.homework;

  const status = useMemo(
    () => getHomeworkStatus(homework),
    [homework],
  );

  const submitDisabledReason = useMemo(
    () => getSubmitDisabledReason(homework),
    [homework],
  );

  const submitDisabled = Boolean(submitDisabledReason);

  async function handleSubmit(payload) {
    const response = await studentApi.submitHomework(
      homeworkId,
      payload,
    );

    setData(response.data);
    setSuccessMessage(
      response.message || "Đã nộp bài thành công.",
    );
  }

  const overdue =
    homework?.isOverdue || isPastDue(homework?.dueDate);

  return (
    <StudentDashboardShell context={data?.context}>
      <div className="mb-4 flex min-w-0 items-center gap-2 text-sm text-slate-500">
        <Link
          to="/student/homeworks"
          className="
            inline-flex shrink-0 items-center gap-1.5 font-bold
            text-slate-500 no-underline transition
            hover:text-[#F27123]
          "
        >
          <FiArrowLeft />
          Bài tập
        </Link>

        <span>/</span>

        <span className="truncate font-bold text-[#0F2747]">
          {homework?.title || "Chi tiết bài tập"}
        </span>
      </div>

      {loading && (
        <LoadingState label="Đang tải chi tiết bài tập..." />
      )}

      {!loading && error && <ErrorAlert error={error} />}

      {!loading && !error && homework && (
        <div
          className="
            grid items-start gap-3
            xl:grid-cols-[minmax(0,1fr)_380px]
          "
        >
          <div className="min-w-0 space-y-4">
            {successMessage && (
              <div
                className="
                  rounded-xl border border-emerald-100 bg-emerald-50
                  px-4 py-3 text-sm font-semibold text-emerald-700
                "
              >
                {successMessage}
              </div>
            )}

            <section className="rounded-3xl border card-border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <span
                    className="
                      mb-3 inline-flex rounded-full bg-blue-50
                      px-3 py-1.5 text-xs font-extrabold uppercase
                      tracking-wide text-[#0F4C8A]
                    "
                  >
                    {homework.subjectName}
                  </span>

                  <h1 className="mb-5 text-2xl font-black leading-tight text-[#0F2747] sm:text-3xl">
                    {homework.title}
                  </h1>

                  <div
                    className="
                      flex flex-wrap items-center gap-x-6 gap-y-3
                      text-sm text-slate-500
                    "
                  >
                    <span className="inline-flex items-center gap-2">
                      <FiUser className="text-[#0F4C8A]" />
                      Giáo viên:
                      <strong className="text-slate-700">
                        {homework.teacherName}
                      </strong>
                    </span>

                    <span className="inline-flex items-center gap-2">
                      <FiCalendar className="text-[#0F4C8A]" />
                      Ngày giao: {formatDate(homework.assignDate)}
                    </span>

                    <span className="inline-flex items-center gap-2">
                      <FiBookOpen className="text-[#0F4C8A]" />
                      Lớp: {homework.className}
                    </span>
                  </div>
                </div>

                <div
                  className={`
                    min-w-[205px] shrink-0 rounded-2xl 
                    px-5 py-4 text-right
                  `}
                >
                  <span
  className={`
    mb-3 inline-flex items-center justify-center
    rounded-full border px-3 py-1.5
    text-xs font-extrabold
    ${
      overdue
        ? "border-red-200 bg-red-100 text-red-600"
        : "border-orange-200 bg-orange-100 text-[#F27123]"
    }
  `}
>
  {status.label}
</span>

                  <p
                    className={`
                      mb-1 flex items-center justify-end gap-1.5
                      text-xs font-extrabold uppercase tracking-wide
                      ${overdue ? "text-red-400" : "text-slate-400"}
                    `}
                  >
                    <FiClock />
                    Hạn nộp
                  </p>

                  <strong
                    className={`
                      block text-base
                      ${overdue ? "text-red-600" : "text-[#F27123]"}
                    `}
                  >
                    {formatDateTime(homework.dueDate)}
                  </strong>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border card-border bg-white p-6 shadow-sm">
              <h3 className="mb-5 flex items-center gap-3 text-2xl font-extrabold text-[#0F2747]">
                <FiAlertCircle className="text-[#F27123]" />
                Hướng dẫn làm bài
              </h3>

              <div className="space-y-5 text-sm leading-7 text-slate-600">
                <p className="mb-0 whitespace-pre-line">
                  {homework.description ||
                    "Bài tập chưa có mô tả chi tiết."}
                </p>

                {homework.instructions && (
                  <div>
                    <p className="mb-2 text-sm font-extrabold text-[#0F2747]">
                      Yêu cầu thực hiện:
                    </p>

                    <p className="mb-0 whitespace-pre-line">
                      {homework.instructions}
                    </p>
                  </div>
                )}

                <p
                  className="
                    mb-0 rounded-xl border-l-4 border-[#F27123]
                    bg-orange-50 px-5 py-4 text-sm italic
                    leading-7 text-slate-600
                  "
                >
                  Lưu ý: Kiểm tra đúng tệp, quyền truy cập đường dẫn
                  và nội dung bài làm trước khi nhấn nộp.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border card-border bg-white p-6 shadow-sm">
              <h3 className="mb-5 flex items-center gap-3 text-xl font-extrabold text-[#0F2747]">
                <FiFileText className="text-[#F27123]" />
                Tài liệu đính kèm
              </h3>

              <HomeworkAttachmentList
                attachments={homework.attachments}
              />
            </section>
            <TeacherFeedback homework={homework} />
          </div>

          <aside className="space-y-3 xl:sticky xl:top-5">
            <SubmissionOverview
              homework={homework}
              status={status}
            />

            <StudentHomeworkSubmitPanel
              disabled={submitDisabled}
              disabledReason={submitDisabledReason}
              defaultContent={homework.submissionContent || ""}
              isResubmission={Boolean(homework.submissionId)}
              onSubmit={handleSubmit}
            />

          </aside>
        </div>
      )}
    </StudentDashboardShell>
  );
}

export default StudentHomeworkDetail;