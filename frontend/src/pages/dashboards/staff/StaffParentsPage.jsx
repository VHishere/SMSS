import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import { formatRelationship } from "../../../utils/formatters";

function StaffParentsPage() {
  const [parents, setParents] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      staffApi
        .getParents(search)
        .then((response) => {
          setParents(response.data);
          setError("");
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const rows = useMemo(
    () =>
      parents.map((parent) => ({
        ...parent,
        id: parent.parentId,
      })),
    [parents],
  );

  return (
    <>
      <StaffPageHeader
        title="Quản lý thông tin phụ huynh"
        description="Theo dõi phụ huynh, mối quan hệ và học sinh liên kết"
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
        title="Danh sách phụ huynh"
        description={`${rows.length} phụ huynh`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, email, SĐT, học sinh..."
        isLoading={loading}
        getRowLink={(row) => `/staff/parents/${row.parentId}`}
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
        ]}
        rows={rows}
        emptyMessage="Không tìm thấy phụ huynh phù hợp"
      />
    </>
  );
}

export default StaffParentsPage;
