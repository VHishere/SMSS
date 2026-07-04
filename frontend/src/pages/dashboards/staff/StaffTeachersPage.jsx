import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import {
  formatAccountStatus,
  formatTeacherType,
} from "../../../utils/formatters";

function StaffTeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      staffApi
        .getTeachers(search)
        .then((response) => {
          setTeachers(response.data);
          setError("");
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const rows = useMemo(
    () =>
      teachers.map((teacher) => ({
        ...teacher,
        id: teacher.teacherId,
      })),
    [teachers],
  );

  return (
    <>
      <StaffPageHeader
        title="Quản lý giáo viên"
        description="Theo dõi hồ sơ giáo viên, chuyên môn và lớp phụ trách"
        action={
          <Link
            to="/staff/teachers/new"
            className="rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline"
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
        title="Danh sách giáo viên"
        description={`${rows.length} giáo viên`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mã GV, email, chuyên môn..."
        isLoading={loading}
        getRowLink={(row) => `/staff/teachers/${row.teacherId}`}
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
        ]}
        rows={rows}
        emptyMessage="Không tìm thấy giáo viên phù hợp"
      />
    </>
  );
}

export default StaffTeachersPage;
