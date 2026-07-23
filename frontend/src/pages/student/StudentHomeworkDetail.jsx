import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    FiArrowLeft,
    FiCalendar,
    FiClock,
} from "react-icons/fi";

import { studentApi } from "../../api/client";
import LoadingState from "../../components/atoms/LoadingState";
import StatusPill from "../../components/atoms/StatusPill";
import ErrorAlert from "../../components/atoms/ErrorAlert";
import HomeworkAttachmentList from "../../components/molecules/HomeworkAttachmentList";
import StudentSubmissionSummary from "../../components/molecules/StudentSubmissionSummary";
import StudentHomeworkSubmitPanel from "../../components/organisms/StudentHomeworkSubmitPanel";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

function formatDateTime(value) {
    if (!value) return "Chưa cập nhật";

    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(String(value).replace(" ", "T")));
}

function getHomeworkStatus(homework) {
    if (homework?.submissionStatus === "GRADED") {
        return { label: "Đã chấm", tone: "green" };
    }

    if (homework?.submissionStatus === "SUBMITTED") {
        return { label: "Đã nộp", tone: "blue" };
    }

    if (homework?.submissionStatus === "LATE" || homework?.isLate) {
        return { label: "Nộp muộn", tone: "red" };
    }

    if (homework?.isOverdue) {
        return { label: "Quá hạn", tone: "red" };
    }

    return { label: "Chưa nộp", tone: "orange" };
}

function StudentHomeworkDetail() {
    const { homeworkId } = useParams();
    const navigate = useNavigate();

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
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [homeworkId]);

    const homework = data?.homework;
    const context = data?.context;

    const status = useMemo(
        () => getHomeworkStatus(homework),
        [homework],
    );

    const submitDisabled =
        homework?.status !== "OPEN" ||
        homework?.submissionStatus === "GRADED";

    const hasDescription = Boolean(homework?.description?.trim());
    const hasInstructions = Boolean(homework?.instructions?.trim());
    const hasAttachments =
        Array.isArray(homework?.attachments) &&
        homework.attachments.length > 0;

    const hasContentBlock =
        hasDescription ||
        hasInstructions ||
        hasAttachments;

    async function handleSubmit(payload) {
        const response = await studentApi.submitHomework(homeworkId, payload);
        setData(response.data);
        setSuccessMessage(response.message || "Đã nộp bài thành công");
    }

    return (
        <StudentDashboardShell context={context}>
            <div className="mb-4">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#0F2747] transition-colors hover:text-[#F27123]"
                >
                    <FiArrowLeft size={16} />
                    Quay lại
                </button>
            </div>

            {loading && <LoadingState label="Đang tải chi tiết bài tập..." />}

            {!loading && error && <ErrorAlert error={error} />}

            {!loading && !error && homework && (
                <div className="space-y-5">
                    {successMessage && (
                        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
                            {successMessage}
                        </div>
                    )}

                    <section className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm sm:p-6">
                        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                            <h2 className="mb-0 break-words text-xl font-black text-[#0F2747] sm:text-2xl">
                                {homework.title}
                            </h2>

                            <div className="flex flex-wrap items-center justify-start gap-2 pt-1 md:justify-end">
                                <StatusPill tone="blue">
                                    {homework.subjectName}
                                </StatusPill>

                                <StatusPill tone={status.tone}>
                                    {status.label}
                                </StatusPill>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 md:items-start">
                            <div className="space-y-2 rounded-2xl bg-slate-50 px-4 py-3">
                                <p className="mb-0 text-sm text-slate-500">
                                    Lớp{" "}
                                    <span className="font-bold text-[#0F2747]">
                                        {homework.className}
                                    </span>
                                </p>

                                <p className="mb-0 text-sm text-slate-500">
                                    Giáo viên:{" "}
                                    <span className="font-bold text-[#0F2747]">
                                        {homework.teacherName}
                                    </span>
                                </p>
                            </div>

                            <div className="space-y-2 rounded-2xl bg-[#FFF7F2] px-4 py-3 text-start md:text-end">
                                <p className="mb-0 flex flex-wrap items-center gap-2 text-sm text-slate-500 md:justify-end">
                                    <FiCalendar className="shrink-0 text-[#F27123]" size={15} />
                                    Ngày giao:{" "}
                                    <span className="font-bold text-[#0F2747]">
                                        {formatDateTime(homework.assignDate)}
                                    </span>
                                </p>

                                <p className="mb-0 flex flex-wrap items-center gap-2 text-sm text-slate-500 md:justify-end">
                                    <FiClock className="shrink-0 text-[#F27123]" size={15} />
                                    Hạn nộp:{" "}
                                    <span className="font-bold text-[#0F2747]">
                                        {formatDateTime(homework.dueDate)}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </section>

                    <div className={`grid gap-5 ${hasContentBlock ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]" : "xl:grid-cols-1"}`}>
                        {hasContentBlock && (
                            <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-6">
                                <h4 className="text-xl font-black text-[#0F2747] sm:text-2xl">
                                    Nội dung
                                </h4>

                                <div className="space-y-6">
                                    {hasDescription && (
                                        <div>
                                            <p className="mb-0 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                                                {homework.description}
                                            </p>
                                        </div>
                                    )}

                                    {hasInstructions && (
                                        <div
                                            className={
                                                hasDescription
                                                    ? "pt-3"
                                                    : ""
                                            }
                                        >
                                            <h5 className="text-base font-bold text-[#0F2747]">
                                                Hướng dẫn
                                            </h5>

                                            <p className="mb-0 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                                                {homework.instructions}
                                            </p>
                                        </div>
                                    )}

                                    {hasAttachments && (
                                        <div
                                            className={
                                                hasDescription || hasInstructions
                                                    ? "border-t border-slate-100 pt-5"
                                                    : ""
                                            }
                                        >
                                            <h4 className="mb-3 text-base font-bold text-[#0F2747]">
                                                Tệp đính kèm của giáo viên
                                            </h4>

                                            <HomeworkAttachmentList
                                                attachments={homework.attachments}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-5">
                            <StudentHomeworkSubmitPanel
                                disabled={submitDisabled}
                                defaultContent={homework.submissionContent || ""}
                                onSubmit={handleSubmit}
                            />
                            <StudentSubmissionSummary homework={homework} />
                        </div>
                    </div>
                </div>
            )}
        </StudentDashboardShell>
    );
}

export default StudentHomeworkDetail;