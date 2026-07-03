import { FiCheckCircle, FiClock, FiFileText } from "react-icons/fi";

import FilePreviewLink from "../atoms/FilePreviewLink";
import StatusPill from "../atoms/StatusPill";

function formatDateTime(value) {
  if (!value) return "Chưa có";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(String(value).replace(" ", "T")));
}

function getSubmissionTone(status) {
  if (status === "GRADED") return "green";
  if (status === "SUBMITTED" || status === "LATE") return "blue";
  return "orange";
}

function getSubmissionLabel(status) {
  if (status === "GRADED") return "Đã chấm";
  if (status === "LATE") return "Nộp muộn";
  if (status === "SUBMITTED") return "Đã nộp";
  return "Chưa nộp";
}

function StudentSubmissionSummary({ homework }) {
  const hasSubmission = Boolean(homework?.submissionId);

  if (!hasSubmission) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
        Bạn chưa nộp bài tập này.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h4 className="mb-0 text-lg font-bold text-[#0F2747]">
          Bài đã nộp
        </h4>

        <StatusPill tone={getSubmissionTone(homework.submissionStatus)}>
          {getSubmissionLabel(homework.submissionStatus)}
        </StatusPill>
      </div>

      <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
        <div className="flex items-center gap-2">
          <FiClock className="text-slate-400" />
          <span>Nộp lúc: {formatDateTime(homework.submitTime)}</span>
        </div>

        <div className="flex items-center gap-2">
          <FiCheckCircle className="text-slate-400" />
          <span>
            Điểm: {homework.score ?? "-"}
            {homework.maxScore ? ` / ${homework.maxScore}` : ""}
          </span>
        </div>
      </div>

      {homework.isLate && (
        <p className="mt-3 mb-0 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          Nộp muộn.
        </p>
      )}

      {homework.submissionContent && (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          <div className="mb-1 flex items-center gap-2 font-bold text-[#0F2747]">
            <FiFileText size={15} />
            Nội dung
          </div>

          <p className="mb-0 whitespace-pre-wrap">
            {homework.submissionContent}
          </p>
        </div>
      )}

      {homework.submissionFileUrl && (
        <div className="mt-4">
          <FilePreviewLink
            fileName="Tệp bài làm đã nộp"
            fileUrl={homework.submissionFileUrl}
          />
        </div>
      )}

      {homework.feedback && (
        <div className="mt-4 rounded-xl bg-[#FFF7F2] px-4 py-3 text-sm leading-6 text-slate-600">
          <span className="font-bold text-[#0F2747]">
            Nhận xét của giáo viên:
          </span>{" "}
          {homework.feedback}
        </div>
      )}
    </div>
  );
}

export default StudentSubmissionSummary;