import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye, FiPlus } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const statusLabels = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã công bố",
  LOCKED: "Đã khóa",
  CANCELLED: "Đã hủy",
};

const scopeLabels = {
  STUDENT: "Từng học sinh",
  CLASS: "Theo lớp",
  GRADE: "Theo khối",
  SCHOOL: "Toàn trường",
};

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function StaffFeesPage() {
  const [fees, setFees] = useState([]);
  const [lookups, setLookups] = useState({ schoolYears: [] });
  const [filters, setFilters] = useState({
    search: "",
    schoolYearId: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeYearId = useMemo(
    () => lookups.schoolYears?.find((item) => item.isActive)?.schoolYearId || "",
    [lookups.schoolYears],
  );

  useEffect(() => {
    staffApi
      .getLookups()
      .then((res) => {
        setLookups(res.data);
        const active = res.data.schoolYears?.find((item) => item.isActive);
        if (active) {
          setFilters((prev) => ({ ...prev, schoolYearId: String(active.schoolYearId) }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    staffApi
      .getFeePlans(filters)
      .then((res) => {
        setFees(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const toolbar = (
    <>
      <select
        className="w-full rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#F27123] focus:bg-white sm:w-auto"
        value={filters.schoolYearId}
        onChange={(event) =>
          setFilters((prev) => ({ ...prev, schoolYearId: event.target.value }))
        }
      >
        <option value="">Tất cả năm học</option>
        {lookups.schoolYears?.map((year) => (
          <option key={year.schoolYearId} value={year.schoolYearId}>
            {year.yearName}
          </option>
        ))}
      </select>

      <select
        className="w-full rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#F27123] focus:bg-white sm:w-auto"
        value={filters.status}
        onChange={(event) =>
          setFilters((prev) => ({ ...prev, status: event.target.value }))
        }
      >
        <option value="">Tất cả trạng thái</option>
        <option value="DRAFT">Nháp</option>
        <option value="PUBLISHED">Đã công bố</option>
        <option value="LOCKED">Đã khóa</option>
        <option value="CANCELLED">Đã hủy</option>
      </select>
    </>
  );

  return (
    <>
      <StaffPageHeader
        title="Quản lý học phí"
        action={
          <Link
            to={`/staff/fees/new${activeYearId ? `?schoolYearId=${activeYearId}` : ""}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#E55C0A] hover:text-white hover:no-underline sm:w-auto"
          >
            <FiPlus size={16} />
            Tạo khoản phí
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <StaffDataTable
        title={`Danh sách học phí - ${fees.length} khoản`}
        toolbar={toolbar}
        searchValue={filters.search}
        onSearchChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
        searchPlaceholder="Tìm khoản học phí..."
        isLoading={loading}
        tableAlignClassName="text-center"
        columns={[
          { key: "title", label: "Khoản phí" },
          { key: "feeType", label: "Loại phí" },
          { key: "schoolYearName", label: "Năm học" },
          {
            key: "scopeType",
            label: "Phạm vi",
            render: (row) => scopeLabels[row.scopeType] || row.scopeType,
          },
          {
            key: "studentCount",
            label: "Học sinh",
            render: (row) => `${row.studentCount || 0}`,
          },
          {
            key: "totalAmount",
            label: "Tổng phải thu",
            render: (row) => formatCurrency(row.totalAmount),
          },
          {
            key: "remainingAmount",
            label: "Còn lại",
            render: (row) => formatCurrency(row.remainingAmount),
          },
          {
            key: "status",
            label: "Trạng thái",
            render: (row) => (
              <StatusBadge
                value={statusLabels[row.status] || row.status}
                tone={row.status === "PUBLISHED" ? "success" : row.status === "CANCELLED" ? "danger" : "info"}
              />
            ),
          },
          {
            key: "actions",
            label: "Chi tiết",
            render: (row) => (
              <Link
                to={`/staff/fees/${row.feePlanId}`}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-[#08509F] no-underline hover:border-[#08509F] hover:text-[#08509F] hover:no-underline"
                title="Xem chi tiết học phí"
              >
                <FiEye size={16} />
              </Link>
            ),
          },
        ]}
        rows={fees.map((item) => ({ ...item, id: item.feePlanId }))}
        emptyMessage="Chưa có khoản học phí nào"
      />
    </>
  );
}

export default StaffFeesPage;
