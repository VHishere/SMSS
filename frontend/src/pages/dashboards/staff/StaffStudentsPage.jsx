import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import {
  formatGender,
  formatStatus,
} from "../../../utils/formatters";

function StaffStudentsPage() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadStudents = () => {
    setLoading(true);
    staffApi
      .getStudents(search)
      .then((response) => {
        setStudents(response.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(loadStudents, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const rows = useMemo(
    () =>
      students.map((student) => ({
        ...student,
        id: student.studentId,
      })),
    [students],
  );

  return (
    <>
      <StaffPageHeader
        title="Quản lý hồ sơ học sinh"
        description="Theo dõi thông tin cá nhân, lớp học và trạng thái học sinh"
        action={
          <Link
            to="/staff/students/new"
            className="rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline"
          >
            + Thêm học sinh
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <StaffDataTable
        title="Danh sách học sinh"
        description={`${rows.length} học sinh`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mã HS, email, lớp..."
        isLoading={loading}
        getRowLink={(row) => `/staff/students/${row.studentId}`}
        columns={[
          { key: "studentCode", label: "Mã HS" },
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
          { key: "className", label: "Lớp" },
          { key: "gradeName", label: "Khối" },
          {
            key: "gender",
            label: "Giới tính",
            render: (row) => formatGender(row.gender),
          },
          { key: "dateOfBirth", label: "Ngày sinh" },
          { key: "phone", label: "Điện thoại" },
          {
            key: "status",
            label: "Trạng thái",
            render: (row) => (
              <StatusBadge
                value={formatStatus(row.status)}
                tone="success"
              />
            ),
          },
        ]}
        rows={rows}
        emptyMessage="Không tìm thấy học sinh phù hợp"
      />
    </>
  );
}

export default StaffStudentsPage;
