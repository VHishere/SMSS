import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiEye } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import { formatGender, formatStatus } from "../../../utils/formatters";
import PrettySelect from "../../../components/molecules/PrettySelect";
import { resolveStaffWorkingSchoolYear } from "../../../utils/staffSchoolYear";

const filterSelectClass =
  "h-12 w-full rounded-full border border-[#DFC0B2] bg-[#F9F9F9] px-4 text-sm font-medium text-[#1A1C1C] outline-none transition hover:border-[#F27123] focus:border-[#F27123] focus:bg-white focus:ring-2 focus:ring-[#F27123]/20 lg:w-44";

function StaffStudentsPage() {
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [lookups, setLookups] = useState(null);
  // Khởi tạo từ ?search= (ô tìm kiếm trên header điều hướng tới đây kèm từ khóa).
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    gradeId: "",
    classId: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    staffApi.getLookups().then((res) => setLookups(res.data)).catch(() => {});
  }, []);

  const workingSchoolYear = useMemo(
    () => resolveStaffWorkingSchoolYear(lookups?.schoolYears || []),
    [lookups?.schoolYears],
  );
  const workingSchoolYearId = workingSchoolYear
    ? String(workingSchoolYear.schoolYearId)
    : "";

  useEffect(() => {
    if (!lookups) return undefined;

    const timer = setTimeout(() => {
      setLoading(true);
      staffApi
        .getStudents({
          search,
          schoolYearId: workingSchoolYearId,
          gradeId: filters.gradeId,
          classId: filters.classId,
          status: filters.status,
        })
        .then((response) => {
          setStudents(response.data);
          setError("");
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [
    search,
    filters.gradeId,
    filters.classId,
    filters.status,
    lookups,
    workingSchoolYearId,
  ]);

  const rows = useMemo(
    () => students.map((student) => ({ ...student, id: student.studentId })),
    [students],
  );

  const filteredClasses = useMemo(
    () =>
      (lookups?.classes || []).filter(
        (cls) =>
          (!workingSchoolYearId ||
            String(cls.schoolYearId) === String(workingSchoolYearId)) &&
          (!filters.gradeId || String(cls.gradeId) === String(filters.gradeId)),
      ),
    [filters.gradeId, lookups?.classes, workingSchoolYearId],
  );

  const filterToolbar = (
    <>
      <PrettySelect
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
      </PrettySelect>

      <PrettySelect
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
      </PrettySelect>

      <PrettySelect
        className={filterSelectClass}
        value={filters.status}
        onChange={(event) =>
          setFilters((prev) => ({ ...prev, status: event.target.value }))
        }
      >
        <option value="ACTIVE">Đang học</option>
        <option value="INACTIVE">Ngưng học</option>
        <option value="TRANSFERRED">Chuyển trường</option>
        <option value="ALL">Tất cả trạng thái</option>
      </PrettySelect>
    </>
  );

  return (
    <>
      <StaffPageHeader
        title="Quản lý học sinh"
        action={
          <Link
            to="/staff/students/new"
            className="rounded-full bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#E55C0A] hover:text-white"
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
        toolbar={filterToolbar}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mã HS, email, lớp..."
        isLoading={loading}
        tableAlignClassName="text-center"
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
          {
            key: "className",
            label: "Lớp",
            render: (row) => row.className || "Chưa xếp lớp",
          },
          {
            key: "gradeName",
            label: "Khối",
            render: (row) => row.gradeName || "-",
          },
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
                tone={row.status === "ACTIVE" ? "success" : "neutral"}
              />
            ),
          },
          {
            key: "detail",
            label: "Chi tiết",
            render: (row) => (
              <Link
                to={`/staff/students/${row.studentId}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DFC0B2] bg-white text-[#08509F] no-underline transition hover:border-[#08509F] hover:bg-blue-50 hover:text-[#08509F]"
                title="Xem chi tiết"
              >
                <FiEye size={18} />
              </Link>
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
