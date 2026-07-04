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
import DashboardShell from "../../components/templates/DashboardShell";

import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentBehaviourSemesters } from "../../hooks/useParentBehaviourSemesters";
import { useParentBehaviourRecords } from "../../hooks/useParentBehaviourRecords";
import { useParentBehaviourConduct } from "../../hooks/useParentBehaviourConduct";
import { formatDate } from "../../utils/dateFormat";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

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
  const { user } = useAuth();
  const { students, loading: studentsLoading } = useParentStudents();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  const effStudentId = selectedStudentId || (students[0]?.studentId ? String(students[0].studentId) : "");
  const { data: semesters, loading: semestersLoading } = useParentBehaviourSemesters(effStudentId);

  const effSemesterId = selectedSemesterId || (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");
  const effSemester = semesters.find((s) => String(s.semesterId) === effSemesterId);

  const recordFilters = useMemo(
    () => ({
      startDate: effSemester?.startDate,
      endDate: effSemester?.endDate,
      page: 1,
      limit: 100,
    }),
    [effSemester?.startDate, effSemester?.endDate],
  );

  const { data: recordsData, loading: recordsLoading, error: recordsError } =
    useParentBehaviourRecords(effStudentId, recordFilters, Boolean(effStudentId));

  const { data: conductData, loading: conductLoading, error: conductError } =
    useParentBehaviourConduct(effStudentId, effSemesterId);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Phụ huynh",
    role: "Phụ huynh",
    avatar: user?.avatar ?? "",
  }), [user]);

  function selectStudent(id) {
    setSelectedStudentId(String(id));
    setSelectedSemesterId("");
  }

  const records = recordsData?.items || [];
  const loading = studentsLoading || semestersLoading || recordsLoading || conductLoading;
  const error = recordsError || conductError;

  const summary = useMemo(
    () =>
      conductData
        ? {
            meritCount: conductData.aggregate?.meritCount || 0,
            meritPoints: conductData.aggregate?.meritPoints || 0,
            violationCount: conductData.aggregate?.violationCount || 0,
            demeritPoints: Math.abs(conductData.aggregate?.demeritPoints || 0),
            totalRecords:
              (conductData.aggregate?.meritCount || 0) +
              (conductData.aggregate?.violationCount || 0),
          }
        : null,
    [conductData],
  );

  const conduct = useMemo(
    () =>
      conductData
        ? {
            finalScore: conductData.computed?.finalScore,
            conductGrade: conductData.computed?.grade?.label,
            baseScore: conductData.computed?.base,
            meritPoints: conductData.computed?.meritPoints,
            demeritPoints: Math.abs(conductData.computed?.demeritPoints || 0),
            comment: conductData.existing?.comment,
            semesterName: effSemester?.semesterName,
            schoolYearName: effSemester?.schoolYearName,
          }
        : null,
    [conductData, effSemester],
  );

  const summaryScore = useMemo(() => {
    if (conduct?.finalScore != null) return conduct.finalScore;
    const merit = Number(summary?.meritPoints || 0);
    const demerit = Number(summary?.demeritPoints || 0);
    return Math.max(0, 100 + merit - demerit);
  }, [conduct, summary]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {/* Student selector + Semester filter — same row */}
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {!studentsLoading && students.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {students.map((s) => (
              <button
                key={s.studentId}
                type="button"
                onClick={() => selectStudent(s.studentId)}
                className="rounded-xl px-4 py-2 text-sm font-medium transition"
                style={
                  String(s.studentId) === effStudentId
                    ? { backgroundColor: "#08509F", color: "#fff" }
                    : { border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#475569" }
                }
              >
                {s.studentFullName}
                {s.className && (
                  <span className="ml-1.5 opacity-70">· {s.className}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        <FilterSelect
          label="Học kỳ"
          value={effSemesterId}
          onChange={(e) => setSelectedSemesterId(e.target.value)}
        >
          {semestersLoading ? (
            <option>Đang tải...</option>
          ) : (
            semesters.map((s) => (
              <option key={s.semesterId} value={s.semesterId}>
                {s.semesterName} · {s.schoolYearName}
              </option>
            ))
          )}
        </FilterSelect>
      </section>

      {loading && <LoadingState label="Đang tải dữ liệu hạnh kiểm..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được hạnh kiểm: ${error}`} />
      )}

      {!loading && !error && (
        <>
          {/* Stat cards */}
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StudentStatCard
              icon={FiShield}
              label="Điểm hạnh kiểm"
              value={summaryScore}
              hint={conduct?.conductGrade || "Tạm tính"}
              tone="blue"
            />
            <StudentStatCard
              icon={FiThumbsUp}
              label="Sự kiện tích cực"
              value={summary?.meritCount || 0}
              hint={`+${summary?.meritPoints || 0} điểm`}
              tone="green"
            />
            <StudentStatCard
              icon={FiXCircle}
              label="Vi phạm"
              value={summary?.violationCount || 0}
              hint={`-${summary?.demeritPoints || 0} điểm`}
              tone="red"
            />
            <StudentStatCard
              icon={FiTrendingUp}
              label="Tổng bản ghi"
              value={summary?.totalRecords || 0}
              tone="orange"
            />
          </section>

          {/* Official conduct evaluation */}
          {conduct && (
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
                    {conduct.semesterName} · {conduct.schoolYearName}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Điểm nền</p>
                  <p className="mb-0 text-xl font-bold text-[#0F2747]">
                    {conduct.baseScore}
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Điểm cộng</p>
                  <p className="mb-0 text-xl font-bold text-green-600">
                    +{conduct.meritPoints}
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Điểm trừ</p>
                  <p className="mb-0 text-xl font-bold text-red-600">
                    -{conduct.demeritPoints}
                  </p>
                </div>
                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Xếp loại</p>
                  <p className="mb-0 text-xl font-bold text-[#F27123]">
                    {conduct.conductGrade || "—"}
                  </p>
                </div>
              </div>

              {conduct.comment && (
                <p className="mt-4 mb-0 text-sm text-slate-600">
                  {conduct.comment}
                </p>
              )}
            </section>
          )}

          {/* Records table */}
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
                      {["Ngày", "Loại", "Tiêu đề", "Mức độ", "Điểm", "Người ghi"].map(
                        (col) => (
                          <th
                            key={col}
                            className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#F27123]"
                          >
                            {col}
                          </th>
                        ),
                      )}
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
                          <StatusPill
                            tone={SEVERITY_TONE[record.severityLevel] || "slate"}
                          >
                            {SEVERITY_LABEL[record.severityLevel] || "—"}
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
    </DashboardShell>
  );
}

export default StudentBehaviour;
