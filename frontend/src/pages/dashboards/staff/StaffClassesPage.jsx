import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffFormCard, { StaffField, inputClass } from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";

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
    loadClasses();
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

  return (
    <>
      <StaffPageHeader
        title="Quản lý lớp học"
        description="Tạo lớp theo khối và năm học, phân bổ học sinh và giáo viên"
        action={
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white"
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

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={filters.schoolYearId}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, schoolYearId: e.target.value }))
          }
        >
          <option value="">Tất cả năm học</option>
          {lookups?.schoolYears?.map((year) => (
            <option key={year.schoolYearId} value={year.schoolYearId}>
              {year.yearName}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={filters.gradeId}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, gradeId: e.target.value }))
          }
        >
          <option value="">Tất cả khối</option>
          {lookups?.grades?.map((grade) => (
            <option key={grade.gradeId} value={grade.gradeId}>
              {grade.gradeName}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="mb-6">
          <StaffFormCard
            title="Tạo lớp học mới"
            onSubmit={handleCreate}
            submitLabel="Tạo lớp"
            loading={saving}
          >
            <StaffField label="Tên lớp">
              <input
                className={inputClass}
                value={form.className}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, className: e.target.value }))
                }
                placeholder="VD: 11A1"
                required
              />
            </StaffField>
            <StaffField label="Khối">
              <select
                className={inputClass}
                value={form.gradeId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, gradeId: e.target.value }))
                }
                required
              >
                <option value="">Chọn khối</option>
                {lookups?.grades?.map((grade) => (
                  <option key={grade.gradeId} value={grade.gradeId}>
                    {grade.gradeName}
                  </option>
                ))}
              </select>
            </StaffField>
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
                {lookups?.schoolYears?.map((year) => (
                  <option key={year.schoolYearId} value={year.schoolYearId}>
                    {year.yearName}
                  </option>
                ))}
              </select>
            </StaffField>
            <StaffField label="Phòng học">
              <input
                className={inputClass}
                value={form.roomName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, roomName: e.target.value }))
                }
                placeholder="VD: P.301"
              />
            </StaffField>
          </StaffFormCard>
        </div>
      )}

      <StaffDataTable
        title="Danh sách lớp học"
        description={`${rows.length} lớp`}
        showSearch={false}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={loading}
        getRowLink={(row) => `/staff/classes/${row.classId}`}
        columns={[
          { key: "className", label: "Lớp" },
          { key: "gradeName", label: "Khối" },
          { key: "schoolYearName", label: "Năm học" },
          { key: "roomName", label: "Phòng" },
          { key: "studentCount", label: "Học sinh" },
          { key: "teacherCount", label: "Giáo viên" },
        ]}
        rows={rows}
        emptyMessage="Chưa có lớp học nào"
      />

      <p className="mt-4 text-sm text-slate-500">
        Nhấn vào một lớp để thêm học sinh và phân công giáo viên.{" "}
        <Link to="/staff/promotion" className="font-semibold text-[#08509F]">
          Chuyển học sinh lên khối
        </Link>
      </p>
    </>
  );
}

export default StaffClassesPage;
