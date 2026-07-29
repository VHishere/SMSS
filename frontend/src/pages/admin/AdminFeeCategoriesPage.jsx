import { useEffect, useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";

import { adminApi, staffApi } from "../../api/client";
import Modal from "../../components/atoms/Modal";
import StaffDataTable from "../../components/staff/StaffDataTable";
import StaffPageHeader from "../../components/staff/StaffPageHeader";
import StatusBadge from "../../components/staff/StatusBadge";
import { inputClass } from "../../components/staff/StaffFormCard";
import PrettySelect from "../../components/molecules/PrettySelect";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const statusLabels = {
  ACTIVE: "Đang áp dụng",
  INACTIVE: "Ngừng áp dụng",
};

const billingCycleLabels = {
  ONE_TIME: "Một lần",
  MONTHLY: "Hàng tháng",
  PER_SEMESTER: "Theo học kỳ",
  PER_YEAR: "Theo năm học",
};

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

const emptyCategoryForm = { name: "", description: "" };

function CategoryFormModal({ category, onClose, onSaved }) {
  const [form, setForm] = useState(
    category ? { name: category.name, description: category.description || "" } : emptyCategoryForm,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (category) {
        await adminApi.updateFeeCategory(category.feeCategoryId, form);
      } else {
        await adminApi.createFeeCategory(form);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={category ? "Sửa loại phí" : "Tạo loại phí"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
          Tên loại phí
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="VD: Học phí, Bán trú, Ngoại khóa..."
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
          Mô tả
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Mô tả loại phí này áp dụng cho khoản thu nào"
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0F2747]"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#F27123] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const emptyRateForm = {
  schoolYearId: "",
  semesterId: "",
  gradeId: "",
  classId: "",
  amount: "",
  billingCycle: "PER_SEMESTER",
};

function RateFormModal({ rate, category, lookups, onClose, onSaved }) {
  const [form, setForm] = useState(
    rate
      ? {
          schoolYearId: String(rate.schoolYearId),
          semesterId: rate.semesterId ? String(rate.semesterId) : "",
          gradeId: rate.gradeId ? String(rate.gradeId) : "",
          classId: rate.classId ? String(rate.classId) : "",
          amount: String(rate.amount),
          billingCycle: rate.billingCycle,
        }
      : emptyRateForm,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredSemesters = useMemo(
    () =>
      lookups.semesters?.filter(
        (semester) => !form.schoolYearId || String(semester.schoolYearId) === String(form.schoolYearId),
      ) || [],
    [lookups.semesters, form.schoolYearId],
  );

  const filteredClasses = useMemo(
    () =>
      lookups.classes?.filter((item) => {
        const sameYear = !form.schoolYearId || String(item.schoolYearId) === String(form.schoolYearId);
        const sameGrade = !form.gradeId || String(item.gradeId) === String(form.gradeId);
        return sameYear && sameGrade;
      }) || [],
    [lookups.classes, form.schoolYearId, form.gradeId],
  );

  const setField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "schoolYearId") {
        next.semesterId = "";
        next.classId = "";
      }
      if (field === "gradeId") {
        next.classId = "";
      }
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = { ...form, feeCategoryId: category.feeCategoryId, amount: Number(form.amount) };

    try {
      if (rate) {
        await adminApi.updateFeeRate(rate.feeRateId, payload);
      } else {
        await adminApi.createFeeRate(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={rate ? "Sửa mức thu" : "Tạo mức thu"} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747] md:col-span-2">
            Loại phí
            <div className={`${inputClass} flex items-center bg-slate-100 text-slate-600`}>
              {category.name}
            </div>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
            Năm học
            <PrettySelect
              className={inputClass}
              value={form.schoolYearId}
              onChange={(event) => setField("schoolYearId", event.target.value)}
              required
            >
              <option value="">Chọn năm học</option>
              {lookups.schoolYears?.map((year) => (
                <option key={year.schoolYearId} value={year.schoolYearId}>
                  {year.yearName}
                </option>
              ))}
            </PrettySelect>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
            Học kỳ (tùy chọn)
            <PrettySelect
              className={inputClass}
              value={form.semesterId}
              onChange={(event) => setField("semesterId", event.target.value)}
            >
              <option value="">Áp dụng cả năm</option>
              {filteredSemesters.map((semester) => (
                <option key={semester.semesterId} value={semester.semesterId}>
                  {semester.semesterName}
                </option>
              ))}
            </PrettySelect>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
            Chu kỳ thu
            <PrettySelect
              className={inputClass}
              value={form.billingCycle}
              onChange={(event) => setField("billingCycle", event.target.value)}
            >
              <option value="ONE_TIME">Một lần</option>
              <option value="MONTHLY">Hàng tháng</option>
              <option value="PER_SEMESTER">Theo học kỳ</option>
              <option value="PER_YEAR">Theo năm học</option>
            </PrettySelect>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
            Khối (tùy chọn)
            <PrettySelect
              className={inputClass}
              value={form.gradeId}
              onChange={(event) => setField("gradeId", event.target.value)}
            >
              <option value="">Áp dụng mọi khối</option>
              {lookups.grades?.map((grade) => (
                <option key={grade.gradeId} value={grade.gradeId}>
                  {grade.gradeName}
                </option>
              ))}
            </PrettySelect>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
            Lớp (tùy chọn)
            <PrettySelect
              className={inputClass}
              value={form.classId}
              onChange={(event) => setField("classId", event.target.value)}
            >
              <option value="">Áp dụng mọi lớp</option>
              {filteredClasses.map((classItem) => (
                <option key={classItem.classId} value={classItem.classId}>
                  {classItem.className}
                </option>
              ))}
            </PrettySelect>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747] md:col-span-2">
            Số tiền
            <input
              type="number"
              min="0"
              step="1000"
              className={inputClass}
              value={form.amount}
              onChange={(event) => setField("amount", event.target.value)}
              required
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0F2747]"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#F27123] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// UC-10: Manage Tuition Fee Categories — create, update, activate, deactivate
// categories such as tuition, boarding, extracurricular fees.
// UC-11: Configure Fee Rates — folded into this same page: selecting a
// category reveals a scoped panel to manage that category's rates by
// academic year, semester, grade, class, and billing cycle.
function AdminFeeCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingCategoryId, setPendingCategoryId] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [rateFilters, setRateFilters] = useState({ schoolYearId: "", status: "" });
  const [lookups, setLookups] = useState({ schoolYears: [], semesters: [], grades: [], classes: [] });
  const [pendingRateId, setPendingRateId] = useState(null);
  const [editingRate, setEditingRate] = useState(null);
  const [showCreateRate, setShowCreateRate] = useState(false);

  useEffect(() => {
    staffApi
      .getLookups()
      .then((res) => {
        setLookups(res.data);
        const active = res.data.schoolYears?.find((item) => item.isActive);
        if (active) {
          setRateFilters((prev) => ({ ...prev, schoolYearId: String(active.schoolYearId) }));
        }
      })
      .catch(() => {});
  }, []);

  const loadCategories = () => {
    setLoading(true);
    adminApi
      .getFeeCategories(filters)
      .then((res) => {
        setCategories(res.data);
        setError("");
        setSelectedCategory((prev) =>
          prev ? res.data.find((item) => item.feeCategoryId === prev.feeCategoryId) || null : null,
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(loadCategories, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadRates = () => {
    if (!selectedCategory) {
      setRates([]);
      return;
    }

    setRatesLoading(true);
    adminApi
      .getFeeRates({ feeCategoryId: selectedCategory.feeCategoryId, ...rateFilters })
      .then((res) => {
        setRates(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setRatesLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(loadRates, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, rateFilters]);

  const toggleCategoryStatus = async (category) => {
    const nextStatus = category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const confirmMessage =
      nextStatus === "INACTIVE"
        ? `Ngừng áp dụng loại phí "${category.name}"?`
        : `Kích hoạt lại loại phí "${category.name}"?`;

    if (!window.confirm(confirmMessage)) return;

    setPendingCategoryId(category.feeCategoryId);
    try {
      await adminApi.setFeeCategoryStatus(category.feeCategoryId, nextStatus);
      loadCategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingCategoryId(null);
    }
  };

  const toggleRateStatus = async (rate) => {
    const nextStatus = rate.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const confirmMessage =
      nextStatus === "INACTIVE"
        ? "Ngừng áp dụng mức thu này?"
        : "Kích hoạt lại mức thu này?";

    if (!window.confirm(confirmMessage)) return;

    setPendingRateId(rate.feeRateId);
    try {
      await adminApi.setFeeRateStatus(rate.feeRateId, nextStatus);
      loadRates();
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingRateId(null);
    }
  };

  const categoryToolbar = (
    <PrettySelect
      className="w-full rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#F27123] focus:bg-white sm:w-auto"
      value={filters.status}
      onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
    >
      <option value="">Tất cả trạng thái</option>
      <option value="ACTIVE">Đang áp dụng</option>
      <option value="INACTIVE">Ngừng áp dụng</option>
    </PrettySelect>
  );

  const rateToolbar = (
    <>
      <PrettySelect
        className="w-full rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#F27123] focus:bg-white sm:w-auto"
        value={rateFilters.schoolYearId}
        onChange={(event) => setRateFilters((prev) => ({ ...prev, schoolYearId: event.target.value }))}
      >
        <option value="">Tất cả năm học</option>
        {lookups.schoolYears?.map((year) => (
          <option key={year.schoolYearId} value={year.schoolYearId}>
            {year.yearName}
          </option>
        ))}
      </PrettySelect>

      <PrettySelect
        className="w-full rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#F27123] focus:bg-white sm:w-auto"
        value={rateFilters.status}
        onChange={(event) => setRateFilters((prev) => ({ ...prev, status: event.target.value }))}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="ACTIVE">Đang áp dụng</option>
        <option value="INACTIVE">Ngừng áp dụng</option>
      </PrettySelect>
    </>
  );

  return (
    <>
      <StaffPageHeader
        title="Loại phí"
        action={
          <button
            type="button"
            onClick={() => setShowCreateCategory(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#E55C0A] sm:w-auto"
          >
            <FiPlus size={16} />
            Tạo loại phí
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <StaffDataTable
        title={`Danh sách loại phí - ${categories.length} loại`}
        toolbar={categoryToolbar}
        searchValue={filters.search}
        onSearchChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
        searchPlaceholder="Tìm loại phí..."
        isLoading={loading}
        tableAlignClassName="text-center"
        columns={[
          {
            key: "name",
            label: "Tên loại phí",
            render: (row) => (
              <span
                className={
                  selectedCategory?.feeCategoryId === row.feeCategoryId
                    ? "font-bold text-[#F27123]"
                    : "font-semibold"
                }
              >
                {row.name}
              </span>
            ),
          },
          {
            key: "description",
            label: "Mô tả",
            render: (row) => row.description || "-",
          },
          {
            key: "rateCount",
            label: "Số mức thu",
            render: (row) => `${row.rateCount || 0}`,
          },
          { key: "createdByName", label: "Người tạo" },
          {
            key: "status",
            label: "Trạng thái",
            render: (row) => (
              <StatusBadge
                value={statusLabels[row.status] || row.status}
                tone={row.status === "ACTIVE" ? "success" : "neutral"}
              />
            ),
          },
          {
            key: "actions",
            label: "Thao tác",
            render: (row) => (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(row)}
                  className={
                    selectedCategory?.feeCategoryId === row.feeCategoryId
                      ? "rounded-full bg-[#08509F] px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0F2747] hover:border-[#08509F] hover:text-[#08509F]"
                  }
                >
                  {selectedCategory?.feeCategoryId === row.feeCategoryId ? "Đang xem mức thu" : "Xem mức thu"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategory(row)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0F2747] hover:border-[#F27123] hover:text-[#F27123]"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  disabled={pendingCategoryId === row.feeCategoryId}
                  onClick={() => toggleCategoryStatus(row)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0F2747] disabled:opacity-60"
                >
                  {row.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}
                </button>
              </div>
            ),
          },
        ]}
        rows={categories.map((item) => ({ ...item, id: item.feeCategoryId }))}
        emptyMessage="Chưa có loại phí nào"
      />

      {selectedCategory && (
        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="mb-1 text-lg font-bold text-[#0F2747]">
                  Mức thu của &quot;{selectedCategory.name}&quot;
                </h3>
                <p className="mb-0 text-sm text-slate-500">
                  Định nghĩa và cập nhật số tiền phải đóng theo năm học, học kỳ, khối, lớp.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateRate(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F27123] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E55C0A]"
                >
                  <FiPlus size={16} />
                  Tạo mức thu
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0F2747]"
                >
                  Đóng
                </button>
              </div>
            </div>
          </section>

          <StaffDataTable
            title={`Danh sách mức thu - ${rates.length} mức`}
            toolbar={rateToolbar}
            showSearch={false}
            searchValue=""
            onSearchChange={() => {}}
            isLoading={ratesLoading}
            tableAlignClassName="text-center"
            columns={[
              { key: "schoolYearName", label: "Năm học" },
              {
                key: "semesterName",
                label: "Học kỳ",
                render: (row) => row.semesterName || "Cả năm",
              },
              {
                key: "gradeName",
                label: "Khối",
                render: (row) => row.gradeName || "Mọi khối",
              },
              {
                key: "className",
                label: "Lớp",
                render: (row) => row.className || "Mọi lớp",
              },
              {
                key: "amount",
                label: "Số tiền",
                render: (row) => formatCurrency(row.amount),
              },
              {
                key: "billingCycle",
                label: "Chu kỳ thu",
                render: (row) => billingCycleLabels[row.billingCycle] || row.billingCycle,
              },
              {
                key: "status",
                label: "Trạng thái",
                render: (row) => (
                  <StatusBadge
                    value={statusLabels[row.status] || row.status}
                    tone={row.status === "ACTIVE" ? "success" : "neutral"}
                  />
                ),
              },
              {
                key: "actions",
                label: "Thao tác",
                render: (row) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingRate(row)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0F2747] hover:border-[#F27123] hover:text-[#F27123]"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={pendingRateId === row.feeRateId}
                      onClick={() => toggleRateStatus(row)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0F2747] disabled:opacity-60"
                    >
                      {row.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}
                    </button>
                  </div>
                ),
              },
            ]}
            rows={rates.map((item) => ({ ...item, id: item.feeRateId }))}
            emptyMessage="Chưa có mức thu nào cho loại phí này"
          />
        </div>
      )}

      {showCreateCategory && (
        <CategoryFormModal
          onClose={() => setShowCreateCategory(false)}
          onSaved={() => {
            setShowCreateCategory(false);
            loadCategories();
          }}
        />
      )}

      {editingCategory && (
        <CategoryFormModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={() => {
            setEditingCategory(null);
            loadCategories();
          }}
        />
      )}

      {showCreateRate && selectedCategory && (
        <RateFormModal
          category={selectedCategory}
          lookups={lookups}
          onClose={() => setShowCreateRate(false)}
          onSaved={() => {
            setShowCreateRate(false);
            loadRates();
            loadCategories();
          }}
        />
      )}

      {editingRate && selectedCategory && (
        <RateFormModal
          rate={editingRate}
          category={selectedCategory}
          lookups={lookups}
          onClose={() => setEditingRate(null)}
          onSaved={() => {
            setEditingRate(null);
            loadRates();
          }}
        />
      )}
    </>
  );
}

export default AdminFeeCategoriesPage;
