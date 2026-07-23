import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye } from "react-icons/fi";

import { staffApi } from "../../../api/client";
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

  return (
    <>
      <StaffPageHeader
        title="Quản lý lớp học"
        action={
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="rounded-xl bg-[#F27123] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E55C0A]"
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

      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[#0F2747] transition hover:border-slate-300"
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
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[#0F2747] transition hover:border-slate-300"
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="mb-0 text-base font-bold text-[#0F2747]">
            Danh sách lớp học - {rows.length} lớp
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-center text-sm">
            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3 whitespace-nowrap text-center">Lớp</th>
                <th className="px-6 py-3 whitespace-nowrap text-center">Khối</th>
                <th className="px-6 py-3 whitespace-nowrap text-center">Năm học</th>
                <th className="px-6 py-3 whitespace-nowrap text-center">Phòng</th>
                <th className="px-6 py-3 whitespace-nowrap text-center">Học sinh</th>
                <th className="px-6 py-3 whitespace-nowrap text-center">Giáo viên</th>
                <th className="px-6 py-3 whitespace-nowrap text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    Chưa có lớp học nào
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.classId || index} className="border-t border-slate-100 transition hover:bg-slate-50">
                    <td className="px-6 py-4 align-middle font-semibold text-[#0F2747]">{row.className}</td>
                    <td className="px-6 py-4 align-middle text-[#0F2747]">{row.gradeName}</td>
                    <td className="px-6 py-4 align-middle text-[#0F2747]">{row.schoolYearName}</td>
                    <td className="px-6 py-4 align-middle text-[#0F2747]">{row.roomName || "—"}</td>
                    <td className="px-6 py-4 align-middle text-[#0F2747]">{row.studentCount || 0}</td>
                    <td className="px-6 py-4 align-middle text-[#0F2747]">{row.teacherCount || 0}</td>
                    <td className="px-6 py-4 align-middle">
                      <Link
                        to={`/staff/classes/${row.classId}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#08509F] transition hover:border-[#08509F] hover:bg-blue-50"
                        title="Xem chi tiết"
                      >
                        <FiEye size={18} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </>
  );
}

export default StaffClassesPage;
