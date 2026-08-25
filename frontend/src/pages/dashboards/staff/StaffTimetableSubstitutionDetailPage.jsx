import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiRefreshCw, FiX } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

const STATUS = {
  PENDING: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "Từ chối", className: "bg-red-50 text-red-600" },
  CANCELLED: { label: "Đã hủy", className: "bg-slate-100 text-slate-600" },
};

const REQUEST_TYPE = {
  SUBSTITUTE: "Dạy thay",
  SWAP: "Hoán đổi tiết",
  CANCEL: "Staff sắp xếp",
};

function formatDateVN(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="mb-1 text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mb-0 text-base font-semibold text-[#0F2747]">{value || "-"}</p>
    </div>
  );
}

function StaffTimetableSubstitutionDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [selectedSubstituteTeacherId, setSelectedSubstituteTeacherId] = useState("");

  const loadDetail = useCallback(() => {
    setLoading(true);
    staffApi
      .getTimetableSubstitution(id)
      .then((res) => {
        setDetail(res.data);
        setSelectedSubstituteTeacherId(
          res.data?.substituteTeacherId ? String(res.data.substituteTeacherId) : "",
        );
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const selectedCandidate = useMemo(
    () => (detail?.substituteCandidates || []).find(
      (teacher) => String(teacher.teacherId) === String(selectedSubstituteTeacherId),
    ),
    [detail?.substituteCandidates, selectedSubstituteTeacherId],
  );

  const substituteName = selectedCandidate?.fullName || detail?.substituteName;
  const substituteCode = selectedCandidate?.teacherCode || detail?.substituteTeacherCode;
  const substituteSubject = selectedCandidate?.subjectSpecialize || detail?.substituteSubjectSpecialize;
  const substituteEmail = selectedCandidate?.email || detail?.substituteEmail;

  const handleReview = async (decision) => {
    if (!detail) return;
    const isApprove = decision === "APPROVE";
    const needsSubstitute = detail.requestType === "SUBSTITUTE";
    if (isApprove && needsSubstitute && !selectedSubstituteTeacherId) {
      setError("Vui lòng chọn giáo viên dạy thay trước khi duyệt");
      return;
    }

    const confirmed = window.confirm(
      isApprove
        ? "Duyệt yêu cầu đổi tiết này? Lịch chỉ đổi cho đúng ngày và tiết đã chọn."
        : "Từ chối yêu cầu đổi tiết này?",
    );
    if (!confirmed) return;

    const reviewNote = isApprove
      ? ""
      : window.prompt("Nhập lý do từ chối (tùy chọn):", "") || "";

    setProcessing(true);
    try {
      await staffApi.reviewTimetableSubstitution(detail.substitutionId, {
        decision,
        reviewNote,
        substituteTeacherId: isApprove && needsSubstitute
          ? Number(selectedSubstituteTeacherId)
          : null,
      });
      loadDetail();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const statusMeta = STATUS[detail?.status] || STATUS.PENDING;

  return (
    <>
      <StaffPageHeader
        title="Chi tiết yêu cầu đổi tiết"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/staff/timetable-substitutions"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#08509F] no-underline transition hover:bg-blue-50"
            >
              <FiArrowLeft />
              Quay lại
            </Link>
            <button
              type="button"
              onClick={loadDetail}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#08509F] bg-white px-4 py-2.5 text-sm font-semibold text-[#08509F] transition hover:bg-blue-50"
            >
              <FiRefreshCw />
              Tải lại
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-3xl border card-border bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Đang tải chi tiết yêu cầu...
        </div>
      )}

      {!loading && detail && (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border card-border bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-orange-100 px-5 py-4">
              <div>
                <h2 className="mb-2 text-2xl font-bold text-[#0F2747]">
                  {detail.subjectName} · {detail.className}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#08509F]">
                    {REQUEST_TYPE[detail.requestType] || detail.requestType}
                  </span>
                </div>
              </div>
              {detail.status === "PENDING" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handleReview("REJECT")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    <FiX />
                    Từ chối
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handleReview("APPROVE")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E55C0A] disabled:opacity-60"
                  >
                    <FiCheck />
                    Duyệt
                  </button>
                </div>
              )}
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Năm học" value={detail.schoolYearName} />
              <DetailItem label="Ngày áp dụng" value={formatDateVN(detail.targetDate)} />
              <DetailItem label="Tiết học" value={`Tiết ${detail.periodNo} · ${detail.startTime}-${detail.endTime}`} />
              <DetailItem label="Phòng học" value={detail.roomName} />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl border card-border bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-xl font-bold text-[#0F2747]">Giáo viên yêu cầu</h3>
              <div className="space-y-3">
                <DetailItem label="Họ tên" value={detail.requesterName} />
                <DetailItem label="Mã giáo viên" value={detail.requesterTeacherCode} />
                <DetailItem label="Chuyên môn" value={detail.requesterSubjectSpecialize} />
                <DetailItem label="Email" value={detail.requesterEmail} />
              </div>
            </div>

            <div className="rounded-3xl border card-border bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-xl font-bold text-[#0F2747]">Giáo viên dạy thay</h3>
              <div className="space-y-3">
                {detail.status === "PENDING" && detail.requestType === "SUBSTITUTE" ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <label className="mb-2 block text-xs font-bold uppercase text-slate-500">
                      Chọn giáo viên cùng môn
                    </label>
                    <select
                      value={selectedSubstituteTeacherId}
                      onChange={(event) => setSelectedSubstituteTeacherId(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-[#0F2747] outline-none transition focus:border-[#08509F]"
                    >
                      <option value="">Chọn giáo viên dạy thay</option>
                      {(detail.substituteCandidates || []).map((teacher) => (
                        <option key={teacher.teacherId} value={teacher.teacherId}>
                          {teacher.teacherCode} - {teacher.fullName}
                        </option>
                      ))}
                    </select>
                    {(detail.substituteCandidates || []).length === 0 && (
                      <p className="mb-0 mt-2 text-xs text-red-600">
                        Chưa có giáo viên cùng môn phù hợp để sắp xếp.
                      </p>
                    )}
                  </div>
                ) : detail.requestType === "SUBSTITUTE" ? (
                  <DetailItem label="Họ tên" value={substituteName || "Staff sắp xếp"} />
                ) : (
                  <DetailItem label="Họ tên" value="Không áp dụng" />
                )}
                {detail.requestType === "SUBSTITUTE" && (
                  <>
                    <DetailItem label="Mã giáo viên" value={substituteCode} />
                    <DetailItem label="Chuyên môn" value={substituteSubject} />
                    <DetailItem label="Email" value={substituteEmail} />
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-[#0F2747]">Nội dung xử lý</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem label="Lý do yêu cầu" value={detail.reason} />
              <DetailItem label="Người duyệt" value={detail.reviewerName} />
              <DetailItem label="Ngày tạo" value={detail.createdAt} />
              <DetailItem label="Ngày xử lý" value={detail.reviewedAt} />
            </div>
            {detail.reviewNote && (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-bold text-[#0F2747]">Phản hồi: </span>
                {detail.reviewNote}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && !detail && !error && (
        <div className="rounded-3xl border card-border bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Không tìm thấy yêu cầu đổi tiết.
        </div>
      )}
    </>
  );
}

export default StaffTimetableSubstitutionDetailPage;
