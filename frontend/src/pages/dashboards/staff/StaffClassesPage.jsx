import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiEye, FiTrash2 } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffFormCard, {
  StaffField,
  inputClass,
  primaryActionClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import PrettySelect from "../../../components/molecules/PrettySelect";
import {
  resolveStaffWorkingSchoolYear,
  setStaffWorkingSchoolYearId,
} from "../../../utils/staffSchoolYear";

const filterSelectClass =
  "h-12 w-full rounded-full border border-[#DFC0B2] bg-[#F9F9F9] px-4 text-sm font-medium text-[#1A1C1C] outline-none transition hover:border-[#F27123] focus:border-[#F27123] focus:bg-white focus:ring-2 focus:ring-[#F27123]/20 lg:w-48";

const emptyForm = {
  className: "",
  gradeId: "",
  schoolYearId: "",
  roomName: "",
};

function normalizeClassName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function StaffClassesPage() {
  const [classes, setClasses] = useState([]);
  const [lookups, setLookups] = useState(null);
  const [lookupsReady, setLookupsReady] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [filters, setFilters] = useState({ schoolYearId: "", gradeId: "" });
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    staffApi
      .getLookups()
      .then((res) => {
        const data = res.data || {};
        const workingYear = resolveStaffWorkingSchoolYear(data.schoolYears || []);

        setLookups(data);

        if (workingYear) {
          const workingYearId = String(workingYear.schoolYearId);
          setFilters((prev) => ({
            ...prev,
            schoolYearId: prev.schoolYearId || workingYearId,
          }));
          setForm((prev) => ({
            ...prev,
            schoolYearId: prev.schoolYearId || workingYearId,
          }));
          setStaffWorkingSchoolYearId(workingYearId);
        }

        setLookupsReady(true);
      })
      .catch((err) => {
        setError(err.message);
        setLookupsReady(true);
      });
  }, []);

  const loadClasses = () => {
    setLoading(true);
    staffApi
      .getClasses({
        schoolYearId: filters.schoolYearId,
        gradeId: filters.gradeId,
      })
      .then((res) => {
        setClasses(res.data || []);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!lookupsReady) return;
    loadClasses();
  }, [lookupsReady, filters.schoolYearId, filters.gradeId]);

  const rows = useMemo(
    () => classes.map((item) => ({ ...item, id: item.classId })),
    [classes],
  );

  const handleCreate = (event) => {
    event.preventDefault();
    const className = normalizeClassName(form.className);
    const duplicateClass = classes.some(
      (item) =>
        String(item.schoolYearId) === String(form.schoolYearId) &&
        normalizeClassName(item.className) === className,
    );

    if (!className) {
      setError("Vui lòng nhập tên lớp");
      return;
    }

    if (duplicateClass) {
      setError("Lớp học đã tồn tại trong năm học này");
      return;
    }

    setSaving(true);

    staffApi
      .createClass({
        ...form,
        className,
        gradeId: Number(form.gradeId),
        schoolYearId: Number(form.schoolYearId),
      })
      .then(() => {
        setShowForm(false);
        setForm({
          ...emptyForm,
          schoolYearId: filters.schoolYearId || form.schoolYearId,
        });
        loadClasses();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row) => {
    const hasStudents = Number(row.studentCount || 0) > 0;
    const hasTeachers = Number(row.teacherCount || 0) > 0;
    const hasTimetable = Number(row.timetableCount || 0) > 0;

    if (hasStudents || hasTeachers) {
      setError("Chỉ được xóa lớp sau khi đã gỡ hết học sinh và giáo viên");
      return;
    }

    if (hasTimetable) {
      setError("Chỉ được xóa lớp sau khi đã xóa hết lịch học của lớp");
      return;
    }

    if (!window.confirm(`Xóa lớp ${row.className}?`)) return;

    setDeletingId(row.classId);
    staffApi
      .deleteClass(row.classId)
      .then(() => {
        setError("");
        loadClasses();
      })
      .catch((err) => setError(err.message))
      .finally(() => setDeletingId(null));
  };

  const filterToolbar = (
    <>
      <PrettySelect
        className={filterSelectClass}
        value={filters.schoolYearId}
        onChange={(event) => {
          setStaffWorkingSchoolYearId(event.target.value);
          setFilters((prev) => ({ ...prev, schoolYearId: event.target.value }));
        }}
      >
        <option value="">Tất cả năm học</option>
        {lookups?.schoolYears?.map((year) => (
          <option key={year.schoolYearId} value={year.schoolYearId}>
            {year.yearName}
          </option>
        ))}
      </PrettySelect>

      <PrettySelect
        className={filterSelectClass}
        value={filters.gradeId}
        onChange={(event) =>
          setFilters((prev) => ({ ...prev, gradeId: event.target.value }))
        }
      >
        <option value="">Tất cả khối</option>
        {lookups?.grades?.map((grade) => (
          <option key={grade.gradeId} value={grade.gradeId}>
            {grade.gradeName}
          </option>
        ))}
      </PrettySelect>
    </>
  );

  return (
    <>
      <StaffPageHeader
        title="Quản lý lớp học"
        action={
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className={showForm ? "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#08509F] transition hover:border-[#08509F] hover:bg-blue-50" : primaryActionClass}
          >
            {showForm ? <><FiArrowLeft size={16} /> Quay lại danh sách</> : "+ Tạo lớp học"}
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <StaffFormCard
            title="Tạo lớp học mới"
            onSubmit={handleCreate}
            submitLabel="Tạo lớp"
            loading={saving}
            footer="Lớp học sẽ được gắn với đúng năm học đã chọn."
          >
            <StaffField label="Tên lớp">
              <input
                className={inputClass}
                value={form.className}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, className: event.target.value }))
                }
                placeholder="VD: 11A1"
                required
              />
            </StaffField>
            <StaffField label="Khối">
              <PrettySelect
                className={inputClass}
                value={form.gradeId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, gradeId: event.target.value }))
                }
                required
              >
                <option value="">Chọn khối</option>
                {lookups?.grades?.map((grade) => (
                  <option key={grade.gradeId} value={grade.gradeId}>
                    {grade.gradeName}
                  </option>
                ))}
              </PrettySelect>
            </StaffField>
            <StaffField label="Năm học">
              <PrettySelect
                className={inputClass}
                value={form.schoolYearId}
                onChange={(event) => {
                  setStaffWorkingSchoolYearId(event.target.value);
                  setForm((prev) => ({ ...prev, schoolYearId: event.target.value }))
                }}
                required
              >
                <option value="">Chọn năm học</option>
                {lookups?.schoolYears?.map((year) => (
                  <option key={year.schoolYearId} value={year.schoolYearId}>
                    {year.yearName}
                  </option>
                ))}
              </PrettySelect>
            </StaffField>
            <StaffField label="Phòng học">
              <input
                className={inputClass}
                value={form.roomName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, roomName: event.target.value }))
                }
                placeholder="VD: P.301"
              />
            </StaffField>
          </StaffFormCard>
        </div>
      )}

      <StaffDataTable
        title={`Danh sách lớp học - ${rows.length} lớp`}
        toolbar={filterToolbar}
        showSearch={false}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={loading}
        tableAlignClassName="text-center"
        columns={[
          { key: "className", label: "Lớp" },
          { key: "gradeName", label: "Khối" },
          { key: "schoolYearName", label: "Năm học" },
          {
            key: "roomName",
            label: "Phòng",
            render: (row) => row.roomName || "-",
          },
          {
            key: "studentCount",
            label: "Học sinh",
            render: (row) => row.studentCount || 0,
          },
          {
            key: "teacherCount",
            label: "Giáo viên",
            render: (row) => row.teacherCount || 0,
          },
          {
            key: "actions",
            label: "Thao tác",
            render: (row) => {
              const cannotDelete =
                Number(row.studentCount || 0) > 0 ||
                Number(row.teacherCount || 0) > 0 ||
                Number(row.timetableCount || 0) > 0;
              const deleteTitle = cannotDelete
                ? "Chỉ xóa được khi lớp không còn học sinh, giáo viên và lịch học"
                : "Xóa lớp";

              return (
                <div className="flex items-center justify-center gap-2">
                  <Link
                    to={`/staff/classes/${row.classId}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DFC0B2] bg-white text-[#08509F] no-underline transition hover:border-[#08509F] hover:bg-blue-50 hover:text-[#08509F]"
                    title="Xem chi tiết"
                  >
                    <FiEye size={18} />
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(row)}
                    disabled={cannotDelete || deletingId === row.classId}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-white text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={deleteTitle}
                  >
                    <FiTrash2 size={17} />
                  </button>
                </div>
              );
            },
          },
        ]}
        rows={rows}
        emptyMessage="Chưa có lớp học nào"
      />
    </>
  );
}

export default StaffClassesPage;
