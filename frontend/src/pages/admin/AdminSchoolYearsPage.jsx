import { useEffect, useState } from "react";
import { FiCheckCircle, FiEye, FiLock } from "react-icons/fi";

import { adminApi } from "../../api/client";
import StaffDataTable from "../../components/staff/StaffDataTable";
import StaffPageHeader from "../../components/staff/StaffPageHeader";
import StatusBadge from "../../components/staff/StatusBadge";

const statusLabels = {
  PLANNED: "Dự kiến",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  CLOSED: "Đã đóng",
};

const resultLabels = {
  ELIGIBLE: "Đủ điều kiện",
  ALREADY_ENROLLED: "Đã có lớp năm mới",
  NOT_ELIGIBLE: "Không đủ điều kiện",
  PENDING_DATA: "Thiếu dữ liệu điểm",
  MAPPING_MISSING: "Thiếu lớp kế tiếp",
  INVALID_TARGET_ASSIGNMENT: "Xếp sai khối năm mới",
  GRADUATION_ELIGIBLE: "Hoàn thành khối cuối",
};

function EvaluationPanel({ evaluation }) {
  if (!evaluation) return null;

  const summary = evaluation.summary || {};
  const blockers = (evaluation.items || []).filter((item) =>
    ["PENDING_DATA", "MAPPING_MISSING", "INVALID_TARGET_ASSIGNMENT", "NOT_ELIGIBLE"].includes(item.result),
  );

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            Kết quả xét {evaluation.sourceYear?.yearName}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Năm kế tiếp: {evaluation.targetYear?.yearName || "Chưa có"}. Điều kiện mặc định: ĐTB năm ≥ {evaluation.policy?.minYearAverage ?? 5}, tối đa {evaluation.policy?.maxFailedSubjects ?? 1} môn dưới {evaluation.policy?.subjectPassThreshold ?? 5} điểm và không nghỉ quá {evaluation.attendancePolicy?.maxAbsentSessions ?? 45} buổi.
          </p>
        </div>
        {evaluation.closed && <StatusBadge value="Đã chốt năm học" tone="success" />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        <Summary value={summary.total} label="Tổng HS" />
        <Summary value={(summary.eligible || 0) + (summary.alreadyEnrolled || 0)} label="Đủ điều kiện" />
        <Summary value={summary.notEligible} label="Không đủ" />
        <Summary value={summary.needsStaffAssignment} label="Staff cần xếp lớp" />
        <Summary value={summary.pendingData} label="Thiếu điểm" />
        <Summary value={summary.mappingMissing} label="Thiếu lớp kế tiếp" />
        <Summary value={summary.invalidTargetAssignments} label="Xếp sai khối" />
        <Summary value={summary.graduationEligible} label="Khối cuối" />
      </div>

      {blockers.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <div className="bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Các trường hợp cần chú ý
          </div>
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {blockers.slice(0, 30).map((item) => (
              <div key={item.studentId} className="flex flex-col gap-1 px-4 py-3 text-sm md:flex-row md:items-start md:justify-between md:gap-6">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">
                    {item.fullName} · {item.studentCode} · {item.fromClassName}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{item.reason}</div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-[#08509F]">
                  {resultLabels[item.result] || item.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ value = 0, label }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
      <div className="text-xl font-bold text-slate-800">{value || 0}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function AdminSchoolYearsPage() {
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState("");
  const [closingId, setClosingId] = useState("");
  const [evaluatingId, setEvaluatingId] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadSchoolYears = () => {
    setLoading(true);
    adminApi
      .getSchoolYears()
      .then((res) => {
        setSchoolYears(res.data || []);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSchoolYears();
  }, []);

  const handleEvaluate = (year) => {
    setEvaluatingId(String(year.schoolYearId));
    setError("");
    setNotice("");
    adminApi
      .evaluateSchoolYearPromotion(year.schoolYearId)
      .then((res) => setEvaluation(res.data || null))
      .catch((err) => {
        setError(err.message);
        if (err.details) setEvaluation(err.details);
      })
      .finally(() => setEvaluatingId(""));
  };

  const handleClose = (year) => {
    if (!year.hasEnded) {
      setNotice("");
      setError(
        `Chỉ có thể kết thúc & xét năm học ${year.yearName} sau ngày kết thúc ${year.endDate}.`,
      );
      return;
    }

    const confirmed = window.confirm(
      `Kết thúc năm học ${year.yearName} và xét điều kiện lên lớp? Sau khi chốt, điểm và điểm danh của năm này sẽ không được sửa nữa.`,
    );
    if (!confirmed) return;

    setClosingId(String(year.schoolYearId));
    setError("");
    setNotice("");
    adminApi
      .closeSchoolYear(year.schoolYearId)
      .then((res) => {
        setEvaluation(res.data || null);
        setNotice(res.data?.message || `Đã kết thúc năm học ${year.yearName}.`);
        loadSchoolYears();
      })
      .catch((err) => {
        setError(err.message);
        if (err.details) setEvaluation(err.details);
      })
      .finally(() => setClosingId(""));
  };

  const handleActivate = (year) => {
    if (!year.hasStarted) {
      setNotice("");
      setError(
        `Chưa thể kích hoạt năm học ${year.yearName} trước ngày bắt đầu ${year.startDate}.`,
      );
      return;
    }

    if (year.hasEnded && !year.isActive) {
      setNotice("");
      setError(`Năm học ${year.yearName} đã kết thúc nên không thể kích hoạt.`);
      return;
    }

    const confirmed = window.confirm(
      `Kích hoạt năm học ${year.yearName}? Hệ thống sẽ tự chuyển những học sinh đã đủ điều kiện từ năm học trước sang lớp kế tiếp.`,
    );
    if (!confirmed) return;

    setActivatingId(String(year.schoolYearId));
    setError("");
    setNotice("");
    adminApi
      .activateSchoolYear(year.schoolYearId)
      .then((res) => {
        setSchoolYears(res.data || []);
        setNotice(res.promotion?.message || `Đã kích hoạt năm học ${year.yearName}.`);
        if (res.promotion) setEvaluation(res.promotion);
      })
      .catch((err) => {
        setError(err.message);
        if (err.details) setEvaluation(err.details);
      })
      .finally(() => setActivatingId(""));
  };

  return (
    <>
      <StaffPageHeader title="Quản lý năm học" />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <EvaluationPanel evaluation={evaluation} />

      <StaffDataTable
        title={`Danh sách năm học - ${schoolYears.length} năm học`}
        showSearch={false}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={loading}
        columns={[
          { key: "yearName", label: "Năm học" },
          { key: "startDate", label: "Bắt đầu" },
          { key: "endDate", label: "Kết thúc" },
          { key: "classCount", label: "Số lớp" },
          { key: "studentCount", label: "Số học sinh" },
          {
            key: "status",
            label: "Trạng thái",
            render: (row) => {
              if (row.status === "CLOSED") {
                return <StatusBadge value="Đã đóng" tone="neutral" />;
              }
              if (row.isActive) {
                return <StatusBadge value="Đang áp dụng toàn hệ thống" tone="success" />;
              }
              return (
                <StatusBadge
                  value={statusLabels[row.status] || row.status}
                  tone="info"
                />
              );
            },
          },
          {
            key: "actions",
            label: "Thao tác",
            render: (row) => {
              const canEvaluate = ["ACTIVE", "LOCKED"].includes(row.status);
              const canClose = canEvaluate && row.hasEnded;
              const canShowActivate =
                !row.isActive &&
                row.status !== "CLOSED" &&
                !row.hasEnded;
              const canActivate = canShowActivate && row.hasStarted;

              return (
                <div className="flex flex-wrap justify-center gap-2">
                  {canEvaluate && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEvaluate(row)}
                        disabled={evaluatingId === String(row.schoolYearId)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        <FiEye size={14} />
                        {evaluatingId === String(row.schoolYearId) ? "Đang xét" : "Xem xét"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClose(row)}
                        disabled={!canClose || closingId === String(row.schoolYearId)}
                        title={
                          !row.hasEnded
                            ? `Chỉ có thể kết thúc năm học sau ngày ${row.endDate}`
                            : "Kết thúc năm học và chốt kết quả xét lên lớp"
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-70"
                      >
                        <FiLock size={14} />
                        {closingId === String(row.schoolYearId)
                          ? "Đang chốt"
                          : !row.hasEnded
                            ? "Chưa đến ngày kết thúc"
                            : "Kết thúc & xét"}
                      </button>
                    </>
                  )}

                  {canShowActivate && (
                    <button
                      type="button"
                      onClick={() => handleActivate(row)}
                      disabled={!canActivate || activatingId === String(row.schoolYearId)}
                      title={
                        !row.hasStarted
                          ? `Chỉ có thể kích hoạt từ ngày ${row.startDate}`
                          : "Kích hoạt năm học và áp dụng kết quả xét lên lớp"
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-[#08509F] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#063D79] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-70"
                    >
                      <FiCheckCircle size={14} />
                      {activatingId === String(row.schoolYearId)
                        ? "Đang kích hoạt"
                        : !row.hasStarted
                          ? "Chưa đến ngày bắt đầu"
                          : "Kích hoạt"}
                    </button>
                  )}

                  {row.status === "CLOSED" && (
                    <span className="text-xs font-semibold text-slate-400">Đã chốt</span>
                  )}

                  {row.isActive && row.status !== "CLOSED" && (
                    <span className="self-center text-xs font-semibold text-emerald-600">
                      Năm học hiện hành
                    </span>
                  )}
                </div>
              );
            },
          },
        ]}
        rows={schoolYears.map((item) => ({ ...item, id: item.schoolYearId }))}
        emptyMessage="Chưa có năm học nào"
      />
    </>
  );
}

export default AdminSchoolYearsPage;
