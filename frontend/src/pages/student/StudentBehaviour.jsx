import { useMemo, useState } from "react";
import {
  FiAward,
  FiShield,
  FiThumbsUp,
  FiTrendingUp,
  FiXCircle,
} from "react-icons/fi";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import FilterSelect from "../../components/atoms/FilterSelect";
import LoadingState from "../../components/atoms/LoadingState";
import StatusPill from "../../components/atoms/StatusPill";

import EmptyState from "../../components/molecules/EmptyState";
import StudentStatCard from "../../components/molecules/StudentStatCard";

import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

import { useStudentSelfBehaviour } from "../../hooks/useStudentSelfBehaviour";
import { formatDate } from "../../utils/dateFormat";

const TYPE_LABEL = {
  POSITIVE: "Điểm cộng",
  VIOLATION: "Vi phạm",
};

const SEVERITY_LABEL = {
  LOW: "Nhẹ",
  MEDIUM: "Trung bình",
  HIGH: "Nghiêm trọng",
};

const SEVERITY_TONE = {
  LOW: "green",
  MEDIUM: "orange",
  HIGH: "red",
};

function StudentBehaviour() {
  const [semesterId, setSemesterId] = useState("");

  const {
    data,
    loading,
    error,
  } = useStudentSelfBehaviour({ semesterId });

  const context = data?.context;
  const records = data?.records || [];
  const semesters = data?.semesters || [];

  const summaryScore = useMemo(() => {
    if (data?.conduct?.finalScore != null) return data.conduct.finalScore;

    const merit = Number(data?.summary?.meritPoints || 0);
    const demerit = Number(data?.summary?.demeritPoints || 0);

    return Math.max(0, 100 + merit - demerit);
  }, [data]);

  return (
    <StudentDashboardShell context={context}>
      <section className="mb-5 flex justify-end">
        <FilterSelect
          label="Học kỳ"
          value={semesterId}
          onChange={(event) => setSemesterId(event.target.value)}
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
        </FilterSelect>
      </section>

      {loading && <LoadingState label="Đang tải dữ liệu hạnh kiểm..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được hạnh kiểm: ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StudentStatCard
              icon={FiShield}
              label="Điểm hạnh kiểm"
              value={summaryScore}
              hint={data.conduct?.conductGrade || "Tạm tính"}
              tone="blue"
            />

            <StudentStatCard
              icon={FiThumbsUp}
              label="Sự kiện tích cực"
              value={data.summary?.meritCount || 0}
              hint={`+${data.summary?.meritPoints || 0} điểm`}
              tone="green"
            />

            <StudentStatCard
              icon={FiXCircle}
              label="Vi phạm"
              value={data.summary?.violationCount || 0}
              hint={`-${data.summary?.demeritPoints || 0} điểm`}
              tone="red"
            />

            <StudentStatCard
              icon={FiTrendingUp}
              label="Tổng bản ghi"
              value={data.summary?.totalRecords || 0}
              tone="orange"
            />
          </section>

          {data.conduct && (
            <section className="mb-6 rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#08509F]">
                  <FiAward size={20} />
                </div>

                <div>
                  <h3 className="mb-1 text-base font-bold text-[#0F2747]">
                    Đánh giá hạnh kiểm chính thức
                  </h3>

                  <p className="mb-0 text-sm text-slate-500">
                    {data.conduct.semesterName} · {data.conduct.schoolYearName}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Điểm nền</p>
                  <p className="mb-0 text-xl font-bold text-[#0F2747]">
                    {data.conduct.baseScore}
                  </p>
                </div>

                <div className="rounded-xl bg-green-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Điểm cộng</p>
                  <p className="mb-0 text-xl font-bold text-green-600">
                    +{data.conduct.meritPoints}
                  </p>
                </div>

                <div className="rounded-xl bg-red-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Điểm trừ</p>
                  <p className="mb-0 text-xl font-bold text-red-600">
                    -{data.conduct.demeritPoints}
                  </p>
                </div>

                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Xếp loại</p>
                  <p className="mb-0 text-xl font-bold text-[#F27123]">
                    {data.conduct.conductGrade || "—"}
                  </p>
                </div>
              </div>

              {data.conduct.comment && (
                <p className="mt-4 mb-0 text-sm text-slate-600">
                  {data.conduct.comment}
                </p>
              )}
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
            {records.length === 0 ? (
              <div className="p-6">
                <EmptyState title="Chưa có bản ghi hạnh kiểm" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-orange-100 bg-[#FFF7F2]">
                      {[
                        "Ngày",
                        "Loại",
                        "Tiêu đề",
                        "Mức độ",
                        "Điểm",
                        "Người ghi",
                      ].map((column) => (
                        <th
                          key={column}
                          className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#F27123]"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {records.map((record) => (
                      <tr
                        key={record.behaviorId}
                        className="border-b border-slate-50 hover:bg-orange-50/40"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F2747]">
                          {formatDate(record.recordDate)}
                        </td>

                        <td className="px-4 py-3">
                          <StatusPill
                            tone={record.behaviorType === "POSITIVE" ? "green" : "red"}
                          >
                            {TYPE_LABEL[record.behaviorType] || record.behaviorType}
                          </StatusPill>
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          <p className="mb-1 font-semibold text-[#0F2747]">
                            {record.title}
                          </p>

                          <p className="mb-0 line-clamp-2 text-xs text-slate-500">
                            {record.description || "—"}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <StatusPill tone={SEVERITY_TONE[record.severityLevel] || "slate"}>
                            {SEVERITY_LABEL[record.severityLevel] || record.severityLevel}
                          </StatusPill>
                        </td>

                        <td className="px-4 py-3 font-bold text-[#0F2747]">
                          {record.points}
                        </td>

                        <td className="px-4 py-3 text-slate-500">
                          {record.createdByName || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentBehaviour;