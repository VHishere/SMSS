import { useEffect, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";

import { adminApi } from "../../api/client";
import StaffDataTable from "../../components/staff/StaffDataTable";
import StaffPageHeader from "../../components/staff/StaffPageHeader";
import StatusBadge from "../../components/staff/StatusBadge";

const statusLabels = {
  PLANNED: "Dự kiến",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  CLOSED: "Đã đóng",
};

function AdminSchoolYearsPage() {
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState("");
  const [error, setError] = useState("");

  const loadSchoolYears = () => {
    setLoading(true);
    adminApi
      .getSchoolYears()
      .then((res) => {
        setSchoolYears(res.data || []);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSchoolYears();
  }, []);

  const handleActivate = (year) => {
    if (year.hasEnded && !year.isActive) {
      setError(
        `Năm học ${year.yearName} đã kết thúc nên không thể kích hoạt.`,
      );
      return;
    }

    const confirmed = window.confirm(
      `Kích hoạt năm học ${year.yearName} cho toàn hệ thống? Tất cả user sẽ ưu tiên xem dữ liệu theo năm học này.`,
    );

    if (!confirmed) return;

    setActivatingId(String(year.schoolYearId));
    adminApi
      .activateSchoolYear(year.schoolYearId)
      .then((res) => {
        setSchoolYears(res.data || []);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setActivatingId(""));
  };

  return (
    <>
      <StaffPageHeader title="Quản lý năm học" />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <StaffDataTable
        title={`Danh sách năm học - ${schoolYears.length} năm học`}
        showSearch={false}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={loading}
        columns={[
          { key: "yearName", label: "Năm học" },
          { key: "startDate", label: "Bắt đầu" },
          { key: "endDate", label: "Kết thúc" },
          { key: "classCount", label: "Số lớp" },
          { key: "studentCount", label: "Số học sinh" },
          {
            key: "status",
            label: "Trạng thái",
            render: (row) => {
              if (row.isActive) {
                return (
                  <StatusBadge
                    value="Đang áp dụng toàn hệ thống"
                    tone="success"
                  />
                );
              }

              if (row.hasEnded) {
                return <StatusBadge value="Đã kết thúc" tone="neutral" />;
              }

              return (
                <StatusBadge
                  value={statusLabels[row.status] || row.status}
                  tone="info"
                />
              );
            },
          },
          {
            key: "actions",
            label: "Thao tác",
            render: (row) => {
              if (row.isActive) {
                return (
                  <span className="text-xs font-semibold text-emerald-600">
                    Năm học hiện hành
                  </span>
                );
              }

              if (row.hasEnded) {
                return (
                  <span
                    className="text-xs font-semibold text-slate-400"
                    title="Năm học đã kết thúc nên không thể kích hoạt."
                  >
                    Không thể kích hoạt
                  </span>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => handleActivate(row)}
                  disabled={activatingId === String(row.schoolYearId)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#08509F] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#063D79] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiCheckCircle size={14} />
                  {activatingId === String(row.schoolYearId)
                    ? "Đang kích hoạt"
                    : "Kích hoạt"}
                </button>
              );
            },
          },
        ]}
        rows={schoolYears.map((item) => ({ ...item, id: item.schoolYearId }))}
        emptyMessage="Chưa có năm học nào"
      />
    </>
  );
}

export default AdminSchoolYearsPage;
