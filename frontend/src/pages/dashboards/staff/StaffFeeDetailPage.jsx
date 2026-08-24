import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { staffApi } from "../../../api/client";
import StaffDataTable from "../../../components/staff/StaffDataTable";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import PrettySelect from "../../../components/molecules/PrettySelect";

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
  UNPAID: "Chưa đóng",
  PARTIAL: "Đóng một phần",
  PAID: "Đã đóng",
  OVERDUE: "Quá hạn",
  WAIVED: "Miễn đóng",
};

const paymentMethodLabels = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
  OTHER: "Khác",
};

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function StaffFeeDetailPage() {
  const { id } = useParams();
  const [fee, setFee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "CASH",
    transactionCode: "",
    note: "",
  });

  useEffect(() => {
    let isMounted = true;

    staffApi
      .getFeePlan(id)
      .then((res) => {
        if (isMounted) {
          setFee(res.data);
          setError("");
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const summaryCards = useMemo(() => {
    if (!fee) return [];
    return [
      { label: "Tổng phải thu", value: formatCurrency(fee.totalAmount) },
      { label: "Đã thu", value: formatCurrency(fee.paidAmount) },
      { label: "Còn lại", value: formatCurrency(fee.remainingAmount) },
      { label: "Số học sinh", value: `${fee.assignments?.length || 0}` },
    ];
  }, [fee]);

  const openPaymentForm = (assignment) => {
    setSelectedAssignment(assignment);
    setPaymentForm({
      amount: assignment.remainingAmount || "",
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "CASH",
      transactionCode: "",
      note: "",
    });
  };

  const handlePayment = (event) => {
    event.preventDefault();
    if (!selectedAssignment) return;

    setSaving(true);
    setError("");

    staffApi
      .recordFeePayment(id, selectedAssignment.feeAssignmentId, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
      })
      .then((res) => {
        setFee(res.data);
        setSelectedAssignment(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const handleStatusChange = (status) => {
    setSaving(true);
    staffApi
      .updateFeePlanStatus(id, status)
      .then((res) => {
        setFee(res.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <>
      <StaffPageHeader
        title={fee?.title || "Chi tiết học phí"}
        action={
          <Link
            to="/staff/fees"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#0F2747] no-underline hover:border-[#F27123] hover:text-[#F27123] hover:no-underline sm:w-auto"
          >
            <FiArrowLeft size={16} />
            Quay lại
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border card-border bg-white p-8 text-center text-slate-500">
          Đang tải dữ liệu học phí...
        </div>
      ) : fee ? (
        <div className="space-y-6">
          <section className="rounded-3xl border card-border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    value={statusLabels[fee.status] || fee.status}
                    tone={fee.status === "PUBLISHED" ? "success" : fee.status === "CANCELLED" ? "danger" : "info"}
                  />
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-[#F27123]">
                    {fee.schoolYearName}
                  </span>
                  {fee.semesterName && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {fee.semesterName}
                    </span>
                  )}
                </div>
                <p className="mb-1 text-sm text-slate-500">Hạn đóng: {fee.dueDate || "Chưa đặt"}</p>
                <p className="mb-0 text-sm text-slate-500">Loại phí: {fee.feeType}</p>
              </div>

              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                {fee.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleStatusChange("PUBLISHED")}
                    className="rounded-full bg-[#08509F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Công bố
                  </button>
                )}
                {fee.status !== "LOCKED" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleStatusChange("LOCKED")}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0F2747] disabled:opacity-60"
                  >
                    Khóa
                  </button>
                )}
                {fee.status !== "CANCELLED" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleStatusChange("CANCELLED")}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-60"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </div>

            {fee.description && (
              <p className="mt-4 mb-0 rounded-xl bg-[#FFF7F2] px-4 py-3 text-sm text-[#0F2747]">
                {fee.description}
              </p>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-slate-500">{card.label}</p>
                  <p className="mb-0 text-lg font-bold text-[#0F2747]">{card.value}</p>
                </div>
              ))}
            </div>
          </section>

          {selectedAssignment && (
            <section className="rounded-3xl border card-border bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="mb-1 text-base font-bold text-[#0F2747]">
                    Ghi nhận thanh toán
                  </h3>
                  <p className="mb-0 text-sm text-slate-500">
                    {selectedAssignment.studentCode} - {selectedAssignment.studentName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-[#0F2747]"
                >
                  Đóng
                </button>
              </div>

              <form onSubmit={handlePayment} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
                  Số tiền
                  <input
                    type="number"
                    min="1"
                    max={selectedAssignment.remainingAmount}
                    className="rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#F27123] focus:bg-white"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))
                    }
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
                  Ngày đóng
                  <input
                    type="date"
                    className="rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#F27123] focus:bg-white"
                    value={paymentForm.paymentDate}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, paymentDate: event.target.value }))
                    }
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
                  Hình thức
                  <PrettySelect
                    className="rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#F27123] focus:bg-white"
                    value={paymentForm.paymentMethod}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, paymentMethod: event.target.value }))
                    }
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                    <option value="CARD">Thẻ</option>
                    <option value="OTHER">Khác</option>
                  </PrettySelect>
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0F2747]">
                  Mã giao dịch
                  <input
                    className="rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#F27123] focus:bg-white"
                    value={paymentForm.transactionCode}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, transactionCode: event.target.value }))
                    }
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-full bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Xác nhận
                  </button>
                </div>
              </form>
            </section>
          )}

          <StaffDataTable
            title={`Danh sách công nợ - ${fee.assignments?.length || 0} học sinh`}
            showSearch={false}
            searchValue=""
            onSearchChange={() => {}}
            tableAlignClassName="text-center"
            columns={[
              { key: "studentCode", label: "Mã học sinh" },
              { key: "studentName", label: "Học sinh" },
              { key: "className", label: "Lớp" },
              {
                key: "finalAmount",
                label: "Phải đóng",
                render: (row) => formatCurrency(row.finalAmount),
              },
              {
                key: "paidAmount",
                label: "Đã đóng",
                render: (row) => formatCurrency(row.paidAmount),
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
                    tone={row.status === "PAID" ? "success" : row.status === "OVERDUE" ? "danger" : "info"}
                  />
                ),
              },
              {
                key: "actions",
                label: "Thanh toán",
                render: (row) =>
                  row.remainingAmount > 0 && fee.status !== "CANCELLED" ? (
                    <button
                      type="button"
                      onClick={() => openPaymentForm(row)}
                      className="rounded-full bg-[#08509F] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Ghi nhận
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Hoàn tất</span>
                  ),
              },
            ]}
            rows={(fee.assignments || []).map((item) => ({
              ...item,
              id: item.feeAssignmentId,
            }))}
            emptyMessage="Chưa có học sinh trong khoản phí này"
          />

          <StaffDataTable
            title={`Lịch sử thanh toán - ${fee.payments?.length || 0} giao dịch`}
            showSearch={false}
            searchValue=""
            onSearchChange={() => {}}
            tableAlignClassName="text-center"
            columns={[
              { key: "paymentDate", label: "Ngày đóng" },
              {
                key: "amount",
                label: "Số tiền",
                render: (row) => formatCurrency(row.amount),
              },
              {
                key: "paymentMethod",
                label: "Hình thức",
                render: (row) => paymentMethodLabels[row.paymentMethod] || row.paymentMethod,
              },
              { key: "transactionCode", label: "Mã giao dịch" },
              { key: "recordedByName", label: "Người ghi nhận" },
              { key: "note", label: "Ghi chú" },
            ]}
            rows={(fee.payments || []).map((item) => ({
              ...item,
              id: item.paymentId,
            }))}
            emptyMessage="Chưa có giao dịch thanh toán"
          />
        </div>
      ) : null}
    </>
  );
}

export default StaffFeeDetailPage;
