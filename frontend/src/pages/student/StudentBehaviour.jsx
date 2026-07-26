import { useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiAward,
  FiCheckCircle,
  FiClock,
  FiFilter,
  FiInfo,
  FiShield,
  FiTarget,
  FiThumbsUp,
  FiXCircle,
} from "react-icons/fi";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useStudentSelfBehaviour } from "../../hooks/useStudentSelfBehaviour";

function formatDate(value) {
  if (!value) return "Chưa cập nhật";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getConductGrade(score, officialGrade) {
  if (officialGrade) return officialGrade;

  const value = Number(score);

  if (value >= 90) return "Tốt";
  if (value >= 80) return "Khá";
  if (value >= 65) return "Trung bình";

  return "Cần cải thiện";
}

function getRecordMeta(record) {
  if (record.behaviorType === "POSITIVE") {
    return {
      label: "Khen thưởng",
      className: "bg-emerald-50 text-emerald-700",
      pointClass: "text-emerald-700",
      icon: FiThumbsUp,
    };
  }

  return {
    label: "Vi phạm",
    className: "bg-red-50 text-red-600",
    pointClass: "text-red-600",
    icon: FiAlertTriangle,
  };
}

function StudentBehaviour() {
  const [semesterId, setSemesterId] = useState("");
  const [recordType, setRecordType] = useState("ALL");

  const { data, loading, error } = useStudentSelfBehaviour({
    semesterId,
  });

  const records = data?.records || [];
  const semesters = data?.semesters || [];

  const summaryScore = useMemo(() => {
    if (data?.conduct?.finalScore != null) {
      return Number(data.conduct.finalScore);
    }

    const merit = Number(data?.summary?.meritPoints || 0);
    const demerit = Number(data?.summary?.demeritPoints || 0);

    return Math.max(0, Math.min(100, 100 + merit - demerit));
  }, [data]);

  const grade = getConductGrade(
    summaryScore,
    data?.conduct?.conductGrade,
  );

  const filteredRecords = useMemo(() => {
    if (recordType === "ALL") return records;

    return records.filter(
      (record) => record.behaviorType === recordType,
    );
  }, [records, recordType]);

  const targetText =
    summaryScore >= 90
      ? "Đã đạt mốc xếp loại Tốt"
      : `Còn ${Math.max(0, 90 - summaryScore)} điểm để đạt mốc Tốt`;

  return (
    <StudentDashboardShell context={data?.context}>
      <section className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F27123]">
            Rèn luyện học sinh
          </p>
          <h1 className="mb-1 text-2xl font-black text-[#0F2747]">
            Hạnh kiểm và rèn luyện
          </h1>
        </div>

        <select
          value={semesterId}
          onChange={(event) => setSemesterId(event.target.value)}
          className="h-11 min-w-[250px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#0F2747] outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
        >
          <option value="">Tất cả học kỳ</option>
          {semesters.map((semester) => (
            <option
              key={semester.semesterId}
              value={semester.semesterId}
            >
              {semester.semesterName} · {semester.schoolYearName}
            </option>
          ))}
        </select>
      </section>

      {loading && <LoadingState label="Đang tải dữ liệu hạnh kiểm..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được hạnh kiểm: ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
            <article className="relative overflow-hidden rounded-2xl bg-[#0F4C8A] p-6 text-white shadow-sm">
              <div className="relative z-10">
                <p className="mb-1 text-xs font-bold text-white/75">
                  Xếp loại hạnh kiểm
                </p>
                <p className="mb-4 text-xs text-white/65">
                  {data.conduct
                    ? `${data.conduct.semesterName} · ${data.conduct.schoolYearName}`
                    : "Kết quả tạm tính từ các bản ghi rèn luyện"}
                </p>

                <div className="flex flex-wrap items-end gap-3">
                  <strong className="text-5xl font-black">{grade}</strong>
                  <span className="pb-1 text-xl font-extrabold text-[#FFB27D]">
                    {summaryScore}/100
                  </span>
                </div>

                <span className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white/90">
                  Điểm rèn luyện
                </span>
              </div>

              <FiShield className="absolute -bottom-8 right-3 text-white/10" size={150} />
            </article>

            <div className="grid grid-cols-2 gap-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <FiAward />
                </span>
                <strong className="block text-2xl font-black text-[#0F2747]">
                  {data.summary?.meritCount || 0}
                </strong>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  Khen thưởng
                </span>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-600">
                  <FiAlertTriangle />
                </span>
                <strong className="block text-2xl font-black text-[#0F2747]">
                  {data.summary?.violationCount || 0}
                </strong>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  Vi phạm
                </span>
              </article>

              <article className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#F27123]">
                    <FiTarget />
                  </span>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Tiến độ mục tiêu
                    </p>
                    <p className="mb-0 text-xs font-extrabold text-[#0F2747]">
                      {targetText}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="mb-1 text-base font-extrabold text-[#0F2747]">
                  Nhật ký rèn luyện
                </h2>
                <p className="mb-0 text-xs text-slate-500">
                  Danh sách các sự kiện tích cực và vi phạm đã được ghi nhận.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
                {[
                  { key: "ALL", label: "Tất cả" },
                  { key: "POSITIVE", label: "Khen thưởng" },
                  { key: "VIOLATION", label: "Vi phạm" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setRecordType(option.key)}
                    className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                      recordType === option.key
                        ? "bg-white text-[#F27123] shadow-sm"
                        : "text-slate-500 hover:text-[#0F2747]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Chưa có bản ghi rèn luyện"
                  description="Không có dữ liệu phù hợp với bộ lọc hiện tại."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full border-collapse text-left">
                  <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Ngày ghi nhận</th>
                      <th className="px-4 py-3">Loại nội dung</th>
                      <th className="px-4 py-3">Mô tả chi tiết</th>
                      <th className="px-4 py-3 text-center">Điểm</th>
                      <th className="px-5 py-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((record) => {
                      const meta = getRecordMeta(record);
                      const Icon = meta.icon;
                      const point = Number(record.points || 0);

                      return (
                        <tr
                          key={record.behaviorId}
                          className="transition hover:bg-orange-50/30"
                        >
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold text-slate-600">
                            {formatDate(record.recordDate)}
                          </td>

                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-extrabold ${meta.className}`}>
                              <Icon />
                              {meta.label}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="mb-1 text-xs font-extrabold text-[#0F2747]">
                              {record.title}
                            </p>
                            <p className="mb-0 line-clamp-2 text-[11px] leading-5 text-slate-500">
                              {record.description || "Không có mô tả."}
                            </p>
                            <p className="mb-0 mt-1 text-[10px] text-slate-400">
                              Ghi nhận bởi: {record.createdByName || "Nhà trường"}
                            </p>
                          </td>

                          <td className={`px-4 py-3.5 text-center text-sm font-black ${meta.pointClass}`}>
                            {point > 0 ? `+${point}` : point}
                          </td>

                          <td className="px-5 py-3.5 text-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-700">
                              <FiCheckCircle />
                              Đã ghi nhận
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-blue-800">
                <FiInfo />
                Lưu ý về xếp loại
              </h3>
              <ul className="mb-0 space-y-2 pl-4 text-xs leading-5 text-blue-700">
                <li>Điểm hạnh kiểm được tổng hợp từ điểm nền, điểm cộng và điểm trừ.</li>
                <li>Kết quả chính thức do nhà trường xác nhận vào cuối học kỳ.</li>
              </ul>
            </article>

            <article className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#A94700]">
                <FiClock />
                Khi cần phản hồi
              </h3>
              <p className="mb-0 text-xs leading-5 text-[#A94700]">
                Khi phát hiện bản ghi chưa chính xác, học sinh nên liên hệ giáo viên chủ nhiệm để được kiểm tra và xử lý.
              </p>
            </article>
          </section>
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentBehaviour;