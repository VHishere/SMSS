import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { adminApi, staffApi } from "../../api/client";
import StaffDataTable from "../../components/staff/StaffDataTable";
import StaffPageHeader from "../../components/staff/StaffPageHeader";
import StatusBadge from "../../components/staff/StatusBadge";

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
  ZALOPAY: "ZaloPay",
  OTHER: "Khác",
};

const providerLabels = {
  VIETQR: "VietQR",
  ZALOPAY: "ZaloPay",
};

const transactionStatusLabels = {
  PENDING: "Đang xử lý",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
};

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN");
}

// UC-14 detail view for admin: same data as staff sees, but read-only —
// publishing/locking/cancelling a plan and recording payments stay with
// staff (UC-12/UC-13).
function AdminFeeDetailPage() {
  const { id } = useParams();
  const [fee, setFee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

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

    adminApi
      .getFeePlanTransactions(id)
      .then((res) => {
        if (isMounted) setTransactions(res.data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setTransactionsLoading(false);
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

  return (
    <>
      <StaffPageHeader
        title={fee?.title || "Chi tiết học phí"}
        action={
          <Link
            to="/admin/fees"
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
        <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-slate-500">
          Đang tải dữ liệu học phí...
        </div>
      ) : fee ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
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

          <StaffDataTable
            title={`Lịch sử giao dịch trực tuyến - ${transactions.length} giao dịch`}
            showSearch={false}
            searchValue=""
            onSearchChange={() => {}}
            isLoading={transactionsLoading}
            tableAlignClassName="text-center"
            columns={[
              { key: "studentCode", label: "Mã học sinh" },
              { key: "studentName", label: "Học sinh" },
              {
                key: "provider",
                label: "Kênh thanh toán",
                render: (row) => providerLabels[row.provider] || row.provider,
              },
              {
                key: "amount",
                label: "Số tiền",
                render: (row) => formatCurrency(row.amount),
              },
              {
                key: "appTransId",
                label: "Mã giao dịch",
                render: (row) => row.zpTransId || row.appTransId || "-",
              },
              {
                key: "status",
                label: "Trạng thái",
                render: (row) => (
                  <StatusBadge
                    value={transactionStatusLabels[row.status] || row.status}
                    tone={
                      row.status === "SUCCESS"
                        ? "success"
                        : row.status === "FAILED"
                          ? "danger"
                          : row.status === "CANCELLED"
                            ? "neutral"
                            : "warning"
                    }
                  />
                ),
              },
              {
                key: "createdAt",
                label: "Thời gian",
                render: (row) => formatDateTime(row.createdAt),
              },
            ]}
            rows={transactions.map((item) => ({ ...item, id: item.transactionId }))}
            emptyMessage="Chưa có giao dịch thanh toán trực tuyến nào"
          />
        </div>
      ) : null}
    </>
  );
}

export default AdminFeeDetailPage;
