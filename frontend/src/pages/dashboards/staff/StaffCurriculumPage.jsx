import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffFormCard, {
  StaffField,
  cancelLinkClass,
  inputClass,
  primaryActionClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

function StaffCurriculumPage() {
  const [lookups, setLookups] = useState({
    schoolYears: [],
    semesters: [],
    grades: [],
    subjects: [],
  });
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ schoolYearId: "", semesterId: "" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    schoolYearId: "",
    semesterId: "",
    gradeId: "",
    subjectId: "",
    periodsPerWeek: 2,
    note: "",
  });

  useEffect(() => {
    staffApi.getLookups().then((res) => {
      setLookups(res.data);
      const activeYear =
        res.data.schoolYears?.find((year) => year.isActive) ||
        res.data.schoolYears?.[0];
      if (activeYear) {
        setFilters((prev) => ({
          ...prev,
          schoolYearId: String(activeYear.schoolYearId),
        }));
        setForm((prev) => ({
          ...prev,
          schoolYearId: String(activeYear.schoolYearId),
        }));
      }
    });
  }, []);

  const semesterOptions = useMemo(
    () =>
      lookups.semesters.filter(
        (semester) =>
          !filters.schoolYearId ||
          String(semester.schoolYearId) === filters.schoolYearId,
      ),
    [lookups.semesters, filters.schoolYearId],
  );

  const loadCurriculum = useCallback(() => {
    if (!filters.schoolYearId) return;

    staffApi
      .getCurriculum({
        schoolYearId: filters.schoolYearId,
        semesterId: filters.semesterId || undefined,
      })
      .then((res) => {
        setItems(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters.schoolYearId, filters.semesterId]);

  useEffect(() => {
    loadCurriculum();
  }, [loadCurriculum]);

  const handleCreate = (event) => {
    event.preventDefault();
    setSaving(true);

    staffApi
      .createCurriculumItem({
        ...form,
        schoolYearId: Number(form.schoolYearId),
        semesterId: Number(form.semesterId),
        gradeId: form.gradeId ? Number(form.gradeId) : null,
        subjectId: Number(form.subjectId),
        periodsPerWeek: Number(form.periodsPerWeek),
      })
      .then(() => {
        setShowForm(false);
        loadCurriculum();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const rows = useMemo(
    () => items.map((item) => ({ ...item, id: item.curriculumId })),
    [items],
  );

  return (
    <>
      <StaffPageHeader
        title="Chương trình học"
        description="Thiết lập môn học và buổi học theo từng năm học và học kỳ."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/staff/timetable"
              className={cancelLinkClass}
            >
              Thêm lịch học
            </Link>
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className={primaryActionClass}
            >
              + Thêm môn học
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className={`${inputClass} sm:max-w-64`}
          value={filters.schoolYearId}
          onChange={(e) =>
            setFilters({ schoolYearId: e.target.value, semesterId: "" })
          }
        >
          <option value="">Chọn năm học</option>
          {lookups.schoolYears.map((year) => (
            <option key={year.schoolYearId} value={year.schoolYearId}>
              {year.yearName}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} sm:max-w-64`}
          value={filters.semesterId}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, semesterId: e.target.value }))
          }
        >
          <option value="">Tất cả học kỳ</option>
          {semesterOptions.map((semester) => (
            <option key={semester.semesterId} value={semester.semesterId}>
              {semester.semesterName}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="mb-6">
          <StaffFormCard
            title="Thêm môn vào chương trình"
            onSubmit={handleCreate}
            submitLabel="Thêm môn"
            loading={saving}
            footer="Môn học được lưu theo năm học, học kỳ và khối đã chọn."
          >
            <StaffField label="Năm học">
              <select
                className={inputClass}
                value={form.schoolYearId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, schoolYearId: e.target.value }))
                }
                required
              >
                <option value="">Chọn năm học</option>
                {lookups.schoolYears.map((year) => (
                  <option key={year.schoolYearId} value={year.schoolYearId}>
                    {year.yearName}
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Học kỳ">
              <select
                className={inputClass}
                value={form.semesterId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, semesterId: e.target.value }))
                }
                required
              >
                <option value="">Chọn học kỳ</option>
                {lookups.semesters
                  .filter(
                    (semester) =>
                      !form.schoolYearId ||
                      String(semester.schoolYearId) === form.schoolYearId,
                  )
                  .map((semester) => (
                    <option key={semester.semesterId} value={semester.semesterId}>
                      {semester.semesterName}
                    </option>
                  ))}
              </select>
            </StaffField>
            <StaffField label="Khối (tuỳ chọn)">
              <select
                className={inputClass}
                value={form.gradeId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, gradeId: e.target.value }))
                }
              >
                <option value="">Tất cả khối</option>
                {lookups.grades.map((grade) => (
                  <option key={grade.gradeId} value={grade.gradeId}>
                    {grade.gradeName}
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Môn học">
              <select
                className={inputClass}
                value={form.subjectId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, subjectId: e.target.value }))
                }
                required
              >
                <option value="">Chọn môn</option>
                {lookups.subjects.map((subject) => (
                  <option key={subject.subjectId} value={subject.subjectId}>
                    {subject.subjectName}
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Số buổi/tuần">
              <input
                type="number"
                min="1"
                max="8"
                className={inputClass}
                value={form.periodsPerWeek}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    periodsPerWeek: e.target.value,
                  }))
                }
                required
              />
            </StaffField>
            <StaffField label="Ghi chú" className="md:col-span-2">
              <input
                className={inputClass}
                value={form.note}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
              />
            </StaffField>
          </StaffFormCard>
        </div>
      )}

      <StaffDataTable
        title="Môn học trong chương trình"
        description={`${rows.length} môn`}
        showSearch={false}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={loading}
        getRowLink={(row) => `/staff/curriculum/${row.curriculumId}`}
        columns={[
          { key: "subjectName", label: "Môn học" },
          { key: "semesterName", label: "Học kỳ" },
          {
            key: "gradeName",
            label: "Khối",
            render: (row) => row.gradeName || "Tất cả",
          },
          { key: "periodsPerWeek", label: "Buổi/tuần" },
          { key: "sessionCount", label: "Buổi đã tạo" },
        ]}
        rows={rows}
        emptyMessage={
          filters.schoolYearId
            ? "Chưa có chương trình học cho năm này"
            : "Hãy chọn năm học"
        }
      />
    </>
  );
}

export default StaffCurriculumPage;
