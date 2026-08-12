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
import PrettySelect from "../../../components/molecules/PrettySelect";
import {
  resolveStaffWorkingSchoolYear,
  setStaffWorkingSchoolYearId,
} from "../../../utils/staffSchoolYear";

const CORE_SUBJECT_KEYWORDS = [
  "toan",
  "ngu van",
  "tieng anh",
  "vat ly",
  "vat li",
  "hoa hoc",
  "sinh hoc",
  "lich su",
  "dia ly",
  "dia li",
  "giao duc cong dan",
  "tin hoc",
  "cong nghe",
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

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
  const [applyAllSemesters, setApplyAllSemesters] = useState(false);
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
      const workingYear = resolveStaffWorkingSchoolYear(
        res.data.schoolYears || [],
      );
      if (workingYear) {
        const workingYearId = String(workingYear.schoolYearId);
        setFilters((prev) => ({
          ...prev,
          schoolYearId: workingYearId,
        }));
        setForm((prev) => ({
          ...prev,
          schoolYearId: workingYearId,
        }));
        setStaffWorkingSchoolYearId(workingYearId);
      }
    });
  }, []);

  const filterSemesterOptions = useMemo(
    () =>
      lookups.semesters.filter(
        (semester) =>
          !filters.schoolYearId ||
          String(semester.schoolYearId) === filters.schoolYearId,
      ),
    [lookups.semesters, filters.schoolYearId],
  );

  const formSemesterOptions = useMemo(
    () =>
      lookups.semesters.filter(
        (semester) =>
          !form.schoolYearId ||
          String(semester.schoolYearId) === String(form.schoolYearId),
      ),
    [lookups.semesters, form.schoolYearId],
  );

  const selectedSubject = useMemo(
    () =>
      lookups.subjects.find(
        (subject) => String(subject.subjectId) === String(form.subjectId),
      ),
    [form.subjectId, lookups.subjects],
  );

  const isCoreSubject = useMemo(() => {
    const subjectName = normalizeText(selectedSubject?.subjectName);
    return CORE_SUBJECT_KEYWORDS.some((keyword) =>
      subjectName.includes(keyword),
    );
  }, [selectedSubject]);

  useEffect(() => {
    if (isCoreSubject) {
      setApplyAllSemesters(true);
    }
  }, [isCoreSubject]);

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
    setError("");

    const semesterIds = applyAllSemesters
      ? formSemesterOptions.map((semester) => Number(semester.semesterId))
      : [Number(form.semesterId)];

    staffApi
      .createCurriculumItem({
        ...form,
        schoolYearId: Number(form.schoolYearId),
        semesterId: Number(form.semesterId),
        semesterIds,
        gradeId: form.gradeId ? Number(form.gradeId) : null,
        subjectId: Number(form.subjectId),
        periodsPerWeek: Number(form.periodsPerWeek),
      })
      .then(() => {
        setShowForm(false);
        setForm((prev) => ({
          ...prev,
          semesterId: "",
          subjectId: "",
          note: "",
        }));
        setApplyAllSemesters(false);
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
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/staff/timetable" className={cancelLinkClass}>
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
        <PrettySelect
          className={`${inputClass} sm:max-w-64`}
          value={filters.schoolYearId}
          onChange={(e) => {
            setStaffWorkingSchoolYearId(e.target.value);
            setFilters({ schoolYearId: e.target.value, semesterId: "" });
          }}
        >
          <option value="">Chọn năm học</option>
          {lookups.schoolYears.map((year) => (
            <option key={year.schoolYearId} value={year.schoolYearId}>
              {year.yearName}
            </option>
          ))}
        </PrettySelect>
        <PrettySelect
          className={`${inputClass} sm:max-w-64`}
          value={filters.semesterId}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, semesterId: e.target.value }))
          }
        >
          <option value="">Tất cả học kỳ</option>
          {filterSemesterOptions.map((semester) => (
            <option key={semester.semesterId} value={semester.semesterId}>
              {semester.semesterName}
            </option>
          ))}
        </PrettySelect>
      </div>

      {showForm && (
        <div className="mb-6">
          <StaffFormCard
            title="Thêm môn vào chương trình"
            onSubmit={handleCreate}
            submitLabel="Thêm môn"
            loading={saving}
            footer={
              applyAllSemesters
                ? "Môn học sẽ được tạo cho tất cả học kỳ của năm học đã chọn."
                : "Môn học được lưu theo năm học, học kỳ và khối đã chọn."
            }
          >
            <StaffField label="Năm học">
              <PrettySelect
                className={inputClass}
                value={form.schoolYearId}
                onChange={(e) => {
                  setStaffWorkingSchoolYearId(e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    schoolYearId: e.target.value,
                    semesterId: "",
                  }));
                }}
                required
              >
                <option value="">Chọn năm học</option>
                {lookups.schoolYears.map((year) => (
                  <option key={year.schoolYearId} value={year.schoolYearId}>
                    {year.yearName}
                  </option>
                ))}
              </PrettySelect>
            </StaffField>
            <StaffField label="Học kỳ">
              <PrettySelect
                className={inputClass}
                value={form.semesterId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, semesterId: e.target.value }))
                }
                disabled={applyAllSemesters}
                required={!applyAllSemesters}
              >
                <option value="">
                  {applyAllSemesters ? "Tất cả học kỳ" : "Chọn học kỳ"}
                </option>
                {formSemesterOptions.map((semester) => (
                  <option key={semester.semesterId} value={semester.semesterId}>
                    {semester.semesterName}
                  </option>
                ))}
              </PrettySelect>
            </StaffField>
            <StaffField label="Khối (tuỳ chọn)">
              <PrettySelect
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
              </PrettySelect>
            </StaffField>
            <StaffField label="Môn học">
              <PrettySelect
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
              </PrettySelect>
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
            <StaffField label="Áp dụng">
              <label className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0F2747] shadow-sm">
                <input
                  type="checkbox"
                  checked={applyAllSemesters}
                  onChange={(e) => setApplyAllSemesters(e.target.checked)}
                  className="h-4 w-4 accent-[#F27123]"
                />
                Cả hai học kỳ
              </label>
              {isCoreSubject && (
                <p className="mt-2 text-xs text-slate-500">
                  Môn chính được mặc định học cả hai học kỳ.
                </p>
              )}
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
