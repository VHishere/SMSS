import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffFormCard, {
  StaffField,
  inputClass,
  primaryActionClass,
} from "../../../components/staff/StaffFormCard";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import PrettySelect from "../../../components/molecules/PrettySelect";

function StaffSchoolYearsPage() {
  const [schoolYears, setSchoolYears] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    yearName: "",
    startDate: "",
    endDate: "",
    status: "PLANNED",
  });

  const loadSchoolYears = () => {
    setLoading(true);
    staffApi
      .getSchoolYears()
      .then((res) => {
        setSchoolYears(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSchoolYears();
  }, []);

  const handleCreate = (event) => {
    event.preventDefault();
    setSaving(true);

    staffApi
      .createSchoolYear(form)
      .then(() => {
        setShowForm(false);
        setForm({ yearName: "", startDate: "", endDate: "", status: "PLANNED" });
        loadSchoolYears();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const handleActivate = (schoolYearId) => {
    staffApi
      .activateSchoolYear(schoolYearId)
      .then((res) => setSchoolYears(res.data))
      .catch((err) => setError(err.message));
  };

  return (
    <>
      <StaffPageHeader
        title="Quản lý năm học"
        // description="Tạo năm học mới và kích hoạt năm học hiện tại"
        action={
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className={primaryActionClass}
          >
            + Tạo năm học
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <StaffFormCard
            title="Tạo năm học mới"
            onSubmit={handleCreate}
            submitLabel="Tạo năm học"
            loading={saving}
            footer="Chỉ kích hoạt năm học khi đã sẵn sàng dùng cho lớp, lịch học và học phí."
          >
            <StaffField label="Tên năm học">
              <input
                className={inputClass}
                value={form.yearName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, yearName: e.target.value }))
                }
                placeholder="VD: 2026-2027"
                required
              />
            </StaffField>
            <StaffField label="Ngày bắt đầu">
              <input
                type="date"
                className={inputClass}
                value={form.startDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, startDate: e.target.value }))
                }
              />
            </StaffField>
            <StaffField label="Ngày kết thúc">
              <input
                type="date"
                className={inputClass}
                value={form.endDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, endDate: e.target.value }))
                }
              />
            </StaffField>
            <StaffField label="Trạng thái">
              <PrettySelect
                className={inputClass}
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="PLANNED">Dự kiến</option>
                <option value="ACTIVE">Đang hoạt động</option>
              </PrettySelect>
            </StaffField>
          </StaffFormCard>
        </div>
      )}

      <StaffDataTable
        title="Danh sách năm học"
        description={`${schoolYears.length} năm học`}
        showSearch={false}
        searchValue=""
        onSearchChange={() => {}}
        isLoading={loading}
        columns={[
          { key: "yearName", label: "Năm học" },
          { key: "startDate", label: "Bắt đầu" },
          { key: "endDate", label: "Kết thúc" },
          { key: "classCount", label: "Số lớp" },
          { key: "studentCount", label: "Số HS" },
          {
            key: "status",
            label: "Trạng thái",
            render: (row) => (
              <StatusBadge
                value={row.isActive ? "Đang dùng" : row.status === "PLANNED" ? "Dự kiến" : row.status}
                tone={row.isActive ? "success" : "info"}
              />
            ),
          },
          {
            key: "actions",
            label: "Thao tác",
            render: (row) =>
              !row.isActive ? (
                <button
                  type="button"
                  onClick={() => handleActivate(row.schoolYearId)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#08509F] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <FiCheck size={14} />
                  Kích hoạt
                </button>
              ) : (
                <span className="text-xs font-semibold text-emerald-600">Năm học hiện tại</span>
              ),
          },
        ]}
        rows={schoolYears.map((item) => ({ ...item, id: item.schoolYearId }))}
        emptyMessage="Chưa có năm học nào"
      />
    </>
  );
}

export default StaffSchoolYearsPage;
