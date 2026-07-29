import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffFormCard, {
  StaffField,
  inputClass,
  primaryActionClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import PrettySelect from "../../../components/molecules/PrettySelect";

const filterSelectClass =
  "h-12 w-full rounded-full border border-[#DFC0B2] bg-[#F9F9F9] px-4 text-sm font-medium text-[#1A1C1C] outline-none transition hover:border-[#F27123] focus:border-[#F27123] focus:bg-white focus:ring-2 focus:ring-[#F27123]/20 lg:w-48";

function StaffClassesPage() {
  const [classes, setClasses] = useState([]);
  const [lookups, setLookups] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ schoolYearId: "", gradeId: "" });
  const [form, setForm] = useState({
    className: "",
    gradeId: "",
    schoolYearId: "",
    roomName: "",
  });

  useEffect(() => {
    staffApi.getLookups().then((res) => setLookups(res.data)).catch(() => {});
  }, []);

  const loadClasses = () => {
    setLoading(true);
    staffApi
      .getClasses(filters)
      .then((res) => {
        setClasses(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    staffApi
      .getClasses({
        schoolYearId: filters.schoolYearId,
        gradeId: filters.gradeId,
      })
      .then((res) => {
        setClasses(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters.schoolYearId, filters.gradeId]);

  const rows = useMemo(
    () => classes.map((item) => ({ ...item, id: item.classId })),
    [classes],
  );

  const handleCreate = (event) => {
    event.preventDefault();
    setSaving(true);

    staffApi
      .createClass({
        ...form,
        gradeId: Number(form.gradeId),
        schoolYearId: Number(form.schoolYearId),
      })
      .then(() => {
        setShowForm(false);
        setForm({ className: "", gradeId: "", schoolYearId: "", roomName: "" });
        loadClasses();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const filterToolbar = (
    <>
      <PrettySelect
        className={filterSelectClass}
        value={filters.schoolYearId}
        onChange={(event) =>
          setFilters((prev) => ({ ...prev, schoolYearId: event.target.value }))
        }
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
            className={primaryActionClass}
          >
            + Tạo lớp học
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
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, schoolYearId: event.target.value }))
                }
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
            key: "detail",
            label: "Chi tiết",
            render: (row) => (
              <Link
                to={`/staff/classes/${row.classId}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DFC0B2] bg-white text-[#08509F] no-underline transition hover:border-[#08509F] hover:bg-blue-50 hover:text-[#08509F]"
                title="Xem chi tiết"
              >
                <FiEye size={18} />
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyMessage="Chưa có lớp học nào"
      />
    </>
  );
}

export default StaffClassesPage;
