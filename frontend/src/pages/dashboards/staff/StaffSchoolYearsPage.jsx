import { useEffect, useState } from "react";
import { FiCheckCircle, FiEdit2 } from "react-icons/fi";

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
import {
  getStaffWorkingSchoolYearId,
  resolveStaffWorkingSchoolYear,
  setStaffWorkingSchoolYearId,
} from "../../../utils/staffSchoolYear";

const emptyForm = {
  yearName: "",
  startDate: "",
  endDate: "",
  status: "PLANNED",
};

const statusLabels = {
  PLANNED: "Dự kiến",
  ACTIVE: "Có thể thao tác",
  LOCKED: "Đã khóa",
  CLOSED: "Đã đóng",
};

function StaffSchoolYearsPage() {
  const [schoolYears, setSchoolYears] = useState([]);
  const [workingSchoolYearId, setWorkingSchoolYearId] = useState(
    getStaffWorkingSchoolYearId,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [saving, setSaving] = useState(false);
  const [initializingId, setInitializingId] = useState("");
  const [form, setForm] = useState(emptyForm);

  const loadSchoolYears = () => {
    setLoading(true);
    staffApi
      .getSchoolYears()
      .then((res) => {
        const years = res.data || [];
        const workingYear = resolveStaffWorkingSchoolYear(years);
        setSchoolYears(years);
        if (workingYear) {
          setWorkingSchoolYearId(String(workingYear.schoolYearId));
          setStaffWorkingSchoolYearId(workingYear.schoolYearId);
        }
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSchoolYears();
  }, []);

  const openCreateForm = () => {
    setEditingYear(null);
    setForm(emptyForm);
    setShowForm((prev) => !prev);
    setNotice("");
    setError("");
  };

  const openEditForm = (year) => {
    setEditingYear(year);
    setForm({
      yearName: year.yearName || "",
      startDate: year.startDate || "",
      endDate: year.endDate || "",
      status: year.status || "PLANNED",
    });
    setShowForm(true);
    setNotice("");
    setError("");
  };

  const handleSelectWorkingYear = (year) => {
    const yearId = String(year.schoolYearId);
    setInitializingId(yearId);
    setNotice("");
    setError("");

    staffApi
      .initializeSchoolYear(year.schoolYearId)
      .then((res) => {
        const created = res.data?.created || {};
        const createdTotal =
          (created.classes || 0) +
          (created.curriculumItems || 0) +
          (created.studySessions || 0);
        setWorkingSchoolYearId(yearId);
        setStaffWorkingSchoolYearId(yearId);
        setNotice(
          createdTotal > 0
            ? `Đã chọn năm học ${year.yearName}. Đã chuẩn bị thêm: ${created.classes || 0} lớp, ${created.curriculumItems || 0} chương trình học, ${created.studySessions || 0} buổi học.`
            : `Đã chọn năm học ${year.yearName}. Không tạo thêm dữ liệu mới vì dữ liệu nền đã có sẵn hoặc chưa có nguồn để sao chép.`,
        );
        loadSchoolYears();
      })
      .catch((err) => setError(err.message))
      .finally(() => setInitializingId(""));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");

    const request = editingYear
      ? staffApi.updateSchoolYear(editingYear.schoolYearId, form)
      : staffApi.createSchoolYear(form);

    request
      .then(() => {
        setShowForm(false);
        setEditingYear(null);
        setForm(emptyForm);
        loadSchoolYears();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <>
      <StaffPageHeader
        title="Quản lý năm học"
        action={
          <button
            type="button"
            onClick={openCreateForm}
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

      {notice && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <StaffFormCard
            title={editingYear ? "Chỉnh sửa năm học" : "Tạo năm học mới"}
            onSubmit={handleSubmit}
            submitLabel={editingYear ? "Lưu năm học" : "Tạo năm học"}
            loading={saving}
            footer="Staff chọn năm học để thao tác nghiệp vụ. Admin kích hoạt năm học để giáo viên, học sinh và phụ huynh xem dữ liệu."
          >
            <StaffField label="Tên năm học">
              <input
                className={inputClass}
                value={form.yearName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, yearName: event.target.value }))
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
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startDate: event.target.value }))
                }
                required
              />
            </StaffField>
            <StaffField label="Ngày kết thúc">
              <input
                type="date"
                className={inputClass}
                value={form.endDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, endDate: event.target.value }))
                }
                required
              />
            </StaffField>
            <StaffField label="Trạng thái">
              <PrettySelect
                className={inputClass}
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value }))
                }
              >
                <option value="PLANNED">Dự kiến</option>
                <option value="ACTIVE">Có thể thao tác</option>
                <option value="LOCKED">Đã khóa</option>
                <option value="CLOSED">Đã đóng</option>
              </PrettySelect>
            </StaffField>
          </StaffFormCard>
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
            render: (row) => (
              <div className="flex flex-wrap justify-center gap-2">
                <StatusBadge
                  value={row.isActive ? "Đang áp dụng cho người dùng" : statusLabels[row.status] || row.status}
                  tone={row.isActive ? "success" : "info"}
                />
                {workingSchoolYearId === String(row.schoolYearId) && (
                  <StatusBadge value="Staff đang chọn thao tác" tone="warning" />
                )}
              </div>
            ),
          },
          {
            key: "actions",
            label: "Thao tác",
            render: (row) => (
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectWorkingYear(row)}
                  disabled={initializingId === String(row.schoolYearId)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#08509F] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#063D79] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiCheckCircle size={14} />
                  {initializingId === String(row.schoolYearId)
                    ? "Đang chuẩn bị"
                    : "Chọn thao tác"}
                </button>
                <button
                  type="button"
                  onClick={() => openEditForm(row)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#DFC0B2] bg-white px-3 py-1.5 text-xs font-semibold text-[#08509F] transition hover:border-[#08509F] hover:bg-blue-50"
                >
                  <FiEdit2 size={14} />
                  Sửa
                </button>
              </div>
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
