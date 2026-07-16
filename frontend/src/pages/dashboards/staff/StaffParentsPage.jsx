import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import { formatRelationship } from "../../../utils/formatters";

function StaffParentsPage() {
  const [parents, setParents] = useState([]);
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
        .getParents({
          search,
          gradeId: filters.gradeId,
          classId: filters.classId,
        })
        .then((response) => {
          setParents(response.data);
          setError("");
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [search, filters.gradeId, filters.classId]);

  const rows = useMemo(
    () =>
      parents.map((parent) => ({
        ...parent,
        id: parent.parentId,
      })),
    [parents],
  );

  const filteredClasses = useMemo(
    () =>
      (lookups?.classes || []).filter(
        (cls) =>
          !filters.gradeId ||
          String(cls.gradeId) === String(filters.gradeId),
      ),
    [filters.gradeId, lookups?.classes],
  );

  const filterToolbar = (
    <>
      <select
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[#0F2747] transition hover:border-slate-300"
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
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[#0F2747] transition hover:border-slate-300"
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
        title="Quản lý phụ huynh"
        action={
          <Link
            to="/staff/parents/new"
            className="rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline"
          >
            + Thêm phụ huynh
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
        searchPlaceholder="Tìm theo tên, email, SĐT, học sinh..."
        isLoading={loading}
        tableAlignClassName="text-center"
        columns={[
          {
            key: "fullName",
            label: "Phụ huynh",
            render: (row) => (
              <div>
                <p className="mb-0 font-semibold">{row.fullName}</p>
                <p className="mb-0 text-xs text-slate-500">{row.email}</p>
              </div>
            ),
          },
          {
            key: "relationship",
            label: "Quan hệ",
            render: (row) => formatRelationship(row.relationship),
          },
          {
            key: "studentName",
            label: "Học sinh",
            render: (row) => (
              <div>
                <p className="mb-0 font-semibold">{row.studentName || "—"}</p>
                <p className="mb-0 text-xs text-slate-500">
                  {row.studentCode || "—"}
                </p>
              </div>
            ),
          },
          { key: "className", label: "Lớp" },
          { key: "phone", label: "Điện thoại" },
          {
            key: "isPrimary",
            label: "Liên hệ chính",
            render: (row) => (
              <StatusBadge
                value={row.isPrimary ? "Chính" : "Phụ"}
                tone={row.isPrimary ? "warning" : "neutral"}
              />
            ),
          },
          {
            key: "detail",
            label: "Chi tiết",
            render: (row) => (
              <Link
                to={`/staff/parents/${row.parentId}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#08509F] no-underline transition hover:border-[#08509F] hover:bg-blue-50"
                title="Xem chi tiết"
              >
                <FiEye size={18} />
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyMessage="Không tìm thấy phụ huynh phù hợp"
      />
    </>
  );
}

export default StaffParentsPage;
