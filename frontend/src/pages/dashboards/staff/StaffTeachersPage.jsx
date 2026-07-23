import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import {
  formatAccountStatus,
  formatTeacherType,
} from "../../../utils/formatters";

const filterSelectClass =
  "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-[#0F2747] outline-none transition hover:border-slate-300 focus:border-[#F27123] focus:ring-2 focus:ring-[#F27123]/20 lg:w-44";

function StaffTeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [lookups, setLookups] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ gradeId: "", classId: "" });

  useEffect(() => {
    staffApi.getLookups().then((res) => setLookups(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      staffApi
        .getTeachers({
          search,
          gradeId: filters.gradeId,
          classId: filters.classId,
        })
        .then((response) => {
          setTeachers(response.data);
          setError("");
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [search, filters.gradeId, filters.classId]);

  const rows = useMemo(
    () => teachers.map((teacher) => ({ ...teacher, id: teacher.teacherId })),
    [teachers],
  );

  const filteredClasses = useMemo(
    () =>
      (lookups?.classes || []).filter(
        (cls) => !filters.gradeId || String(cls.gradeId) === String(filters.gradeId),
      ),
    [filters.gradeId, lookups?.classes],
  );

  const filterToolbar = (
    <>
      <select
        className={filterSelectClass}
        value={filters.gradeId}
        onChange={(event) =>
          setFilters((prev) => ({
            ...prev,
            gradeId: event.target.value,
            classId: "",
          }))
        }
      >
        <option value="">Tất cả khối</option>
        {lookups?.grades?.map((grade) => (
          <option key={grade.gradeId} value={grade.gradeId}>
            {grade.gradeName}
          </option>
        ))}
      </select>

      <select
        className={filterSelectClass}
        value={filters.classId}
        onChange={(event) =>
          setFilters((prev) => ({ ...prev, classId: event.target.value }))
        }
      >
        <option value="">Tất cả lớp</option>
        {filteredClasses.map((cls) => (
          <option key={cls.classId} value={cls.classId}>
            {cls.className}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <>
      <StaffPageHeader
        title="Quản lý giáo viên"
        action={
          <Link
            to="/staff/teachers/new"
            className="rounded-full bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#E55C0A] hover:text-white"
          >
            + Thêm giáo viên
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <StaffDataTable
        toolbar={filterToolbar}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mã GV, email, chuyên môn..."
        isLoading={loading}
        tableAlignClassName="text-center"
        columns={[
          { key: "teacherCode", label: "Mã GV" },
          {
            key: "fullName",
            label: "Họ tên",
            render: (row) => (
              <div>
                <p className="mb-0 font-semibold">{row.fullName}</p>
                <p className="mb-0 text-xs text-slate-500">{row.email}</p>
              </div>
            ),
          },
          { key: "subjectSpecialize", label: "Chuyên môn" },
          {
            key: "isHomeroom",
            label: "Loại GV",
            render: (row) => (
              <StatusBadge
                value={formatTeacherType(row.isHomeroom)}
                tone={row.isHomeroom ? "success" : "info"}
              />
            ),
          },
          { key: "classCount", label: "Số lớp" },
          { key: "phone", label: "Điện thoại" },
          {
            key: "status",
            label: "Trạng thái",
            render: (row) => (
              <StatusBadge
                value={formatAccountStatus(row.status)}
                tone={row.status === "ACTIVE" ? "success" : "neutral"}
              />
            ),
          },
          {
            key: "detail",
            label: "Chi tiết",
            render: (row) => (
              <Link
                to={`/staff/teachers/${row.teacherId}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#08509F] no-underline transition hover:border-[#08509F] hover:bg-blue-50"
                title="Xem chi tiết"
              >
                <FiEye size={18} />
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyMessage="Không tìm thấy giáo viên phù hợp"
      />
    </>
  );
}

export default StaffTeachersPage;
