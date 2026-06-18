import { useEffect, useMemo, useState } from "react";

import { staffApi } from "../../../api/client";
import StaffFormCard, { StaffField, inputClass } from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

function StaffPromotionPage() {
  const [lookups, setLookups] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [targetClasses, setTargetClasses] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [form, setForm] = useState({
    fromSchoolYearId: "",
    toSchoolYearId: "",
    fromGradeId: "",
    toGradeId: "",
  });

  useEffect(() => {
    staffApi.getLookups().then((res) => setLookups(res.data)).catch(() => {});
  }, []);

  const grades = lookups?.grades || [];

  const loadCandidates = () => {
    if (!form.fromSchoolYearId || !form.fromGradeId) return;

    setLoading(true);
    setError("");

    Promise.all([
      staffApi.getPromotionCandidates(form.fromSchoolYearId, form.fromGradeId),
      form.toSchoolYearId && form.toGradeId
        ? staffApi.getTargetClasses(form.toSchoolYearId, form.toGradeId)
        : Promise.resolve({ data: [] }),
    ])
      .then(([candidatesRes, targetRes]) => {
        setCandidates(candidatesRes.data);
        setTargetClasses(targetRes.data);
        setAssignments({});
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (form.toSchoolYearId && form.toGradeId) {
      staffApi
        .getTargetClasses(form.toSchoolYearId, form.toGradeId)
        .then((res) => setTargetClasses(res.data))
        .catch(() => {});
    }
  }, [form.toSchoolYearId, form.toGradeId]);

  const readyItems = useMemo(
    () =>
      candidates
        .filter((item) => assignments[item.studentId])
        .map((item) => ({
          studentId: item.studentId,
          fromClassId: item.fromClassId,
          toClassId: Number(assignments[item.studentId]),
        })),
    [candidates, assignments],
  );

  const handlePromote = (event) => {
    event.preventDefault();

    if (!readyItems.length) {
      setError("Hãy chọn lớp đích cho ít nhất một học sinh");
      return;
    }

    setPromoting(true);
    setError("");
    setSuccess("");

    staffApi
      .promoteStudents({
        schoolYearId: Number(form.toSchoolYearId),
        fromGradeId: Number(form.fromGradeId),
        toGradeId: Number(form.toGradeId),
        items: readyItems,
      })
      .then((res) => {
        setSuccess(`Đã chuyển ${res.data.promotedCount} học sinh lên khối mới`);
        loadCandidates();
      })
      .catch((err) => setError(err.message))
      .finally(() => setPromoting(false));
  };

  const handleBulkAssign = (classId) => {
    const next = {};
    candidates.forEach((item) => {
      next[item.studentId] = classId;
    });
    setAssignments(next);
  };

  return (
    <>
      <StaffPageHeader
        title="Chuyển học sinh lên khối"
        description="Chuyển học sinh từ khối dưới lên khối trên trong năm học mới"
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <StaffFormCard
        title="Thiết lập lên khối"
        onSubmit={(e) => {
          e.preventDefault();
          loadCandidates();
        }}
        submitLabel="Tải danh sách học sinh"
        loading={loading}
      >
        <StaffField label="Năm học nguồn">
          <select
            className={inputClass}
            value={form.fromSchoolYearId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, fromSchoolYearId: e.target.value }))
            }
            required
          >
            <option value="">Chọn năm học</option>
            {lookups?.schoolYears?.map((year) => (
              <option key={year.schoolYearId} value={year.schoolYearId}>
                {year.yearName}
              </option>
            ))}
          </select>
        </StaffField>
        <StaffField label="Khối nguồn">
          <select
            className={inputClass}
            value={form.fromGradeId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, fromGradeId: e.target.value }))
            }
            required
          >
            <option value="">Chọn khối</option>
            {grades.map((grade) => (
              <option key={grade.gradeId} value={grade.gradeId}>
                {grade.gradeName}
              </option>
            ))}
          </select>
        </StaffField>
        <StaffField label="Năm học đích">
          <select
            className={inputClass}
            value={form.toSchoolYearId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, toSchoolYearId: e.target.value }))
            }
            required
          >
            <option value="">Chọn năm học</option>
            {lookups?.schoolYears?.map((year) => (
              <option key={year.schoolYearId} value={year.schoolYearId}>
                {year.yearName}
              </option>
            ))}
          </select>
        </StaffField>
        <StaffField label="Khối đích">
          <select
            className={inputClass}
            value={form.toGradeId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, toGradeId: e.target.value }))
            }
            required
          >
            <option value="">Chọn khối</option>
            {grades.map((grade) => (
              <option key={grade.gradeId} value={grade.gradeId}>
                {grade.gradeName}
              </option>
            ))}
          </select>
        </StaffField>
      </StaffFormCard>

      {candidates.length > 0 && (
        <div className="mt-6 rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="mb-1 text-lg font-bold text-[#0F2747]">
                {candidates.length} học sinh cần lên khối
              </h3>
              <p className="mb-0 text-sm text-slate-500">
                Chọn lớp đích cho từng học sinh hoặc gán hàng loạt
              </p>
            </div>
            {targetClasses.length > 0 && (
              <select
                className="rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) handleBulkAssign(e.target.value);
                }}
              >
                <option value="">Gán tất cả vào lớp...</option>
                {targetClasses.map((cls) => (
                  <option key={cls.classId} value={cls.classId}>
                    {cls.className} ({cls.studentCount} HS)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#FFF7F2] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Mã HS</th>
                  <th className="px-4 py-2 text-left">Họ tên</th>
                  <th className="px-4 py-2 text-left">Lớp hiện tại</th>
                  <th className="px-4 py-2 text-left">Lớp đích</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((item) => (
                  <tr key={item.studentId} className="border-t border-slate-100">
                    <td className="px-4 py-3">{item.studentCode}</td>
                    <td className="px-4 py-3 font-semibold">{item.fullName}</td>
                    <td className="px-4 py-3">{item.fromClassName}</td>
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        value={assignments[item.studentId] || ""}
                        onChange={(e) =>
                          setAssignments((prev) => ({
                            ...prev,
                            [item.studentId]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Chọn lớp</option>
                        {targetClasses.map((cls) => (
                          <option key={cls.classId} value={cls.classId}>
                            {cls.className}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={promoting || !readyItems.length}
              onClick={handlePromote}
              className="rounded-xl bg-[#F27123] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {promoting
                ? "Đang chuyển..."
                : `Chuyển ${readyItems.length} học sinh lên khối`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default StaffPromotionPage;
