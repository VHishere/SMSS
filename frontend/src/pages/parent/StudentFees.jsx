import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import DashboardShell from "../../components/templates/DashboardShell";
import Modal from "../../components/atoms/Modal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentFees } from "../../hooks/useParentStudentFees";
import { parentApi } from "../../api/client";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";
import PrettySelect from "../../components/molecules/PrettySelect";

// ─── FSchool Stitch design tokens (matches the other parent portal pages) ────

const C = {
  onSurface: "#1A1C1C",
  onSurfaceVariant: "#584238",
  outlineVariant: "#DFC0B2",
  primary: "#9F4200",
  primaryContainer: "#F27123",
  secondary: "#225DAD",
  deepBlue: "#00458E",
  tertiary: "#4A5F82",
  error: "#BA1A1A",
  surface: "#F9F9F9",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};

const CARD_SHADOW = "0px 4px 12px rgba(15, 39, 71, 0.08)";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function Ms({ name, className = "", style, fill = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}
    >
      {name}
    </span>
  );
}

const STATUS_OPTIONS = [
  { key: "", label: "Tất cả trạng thái" },
  { key: "UNPAID", label: "Chưa đóng" },
  { key: "PARTIAL", label: "Đóng một phần" },
  { key: "PAID", label: "Đã đóng" },
  { key: "OVERDUE", label: "Quá hạn" },
  { key: "WAIVED", label: "Miễn đóng" },
];

const STATUS_PILL = {
  UNPAID: { label: "Chưa đóng", bg: "rgba(242, 113, 35, 0.1)", text: "#9F4200" },
  PARTIAL: { label: "Đóng một phần", bg: "rgba(34, 93, 173, 0.1)", text: "#225DAD" },
  PAID: { label: "Đã đóng", bg: "rgba(5, 150, 105, 0.12)", text: "#059669" },
  OVERDUE: { label: "Quá hạn", bg: "rgba(186, 26, 26, 0.1)", text: "#BA1A1A" },
  WAIVED: { label: "Miễn đóng", bg: "rgba(88, 66, 56, 0.1)", text: C.onSurfaceVariant },
  CANCELLED: { label: "Đã hủy", bg: "rgba(88, 66, 56, 0.1)", text: C.onSurfaceVariant },
};

// A cancelled fee plan no longer needs to be paid, regardless of what the
// underlying assignment status says — the plan-level status always wins.
function effectiveStatus(row) {
  return row.planStatus === "CANCELLED" ? "CANCELLED" : row.status;
}

function StatusBadge({ status }) {
  const cfg = STATUS_PILL[status] ?? { label: status, bg: "#F1F5F9", text: "#475569" };
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function SummaryCard({ label, value, caption, iconName, accent }) {
  return (
    <div
      className="rounded-4xl bg-white p-6 transition-transform hover:-translate-y-0.5"
      style={{ borderLeft: `4px solid ${accent}`, boxShadow: CARD_SHADOW }}
    >
      <div className="mb-2 flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>
          {label}
        </p>
        <Ms name={iconName} style={{ color: accent }} />
      </div>
      <span className="text-3xl font-bold leading-none tracking-tight" style={{ color: C.onSurface }}>
        {value}
      </span>
      {caption && (
        <p className="mt-2 text-xs italic" style={{ color: C.onSurfaceVariant }}>
          {caption}
        </p>
      )}
    </div>
  );
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: C.surfaceLow }}>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>{label}</p>
        <p className="truncate text-sm font-semibold" style={{ color: C.onSurface }}>{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition"
        style={{ backgroundColor: copied ? "rgba(5,150,105,0.15)" : "rgba(242,113,35,0.15)", color: copied ? "#059669" : C.primary }}
      >
        <Ms name={copied ? "check" : "content_copy"} className="!text-[14px]!" />
        {copied ? "Đã chép" : "Sao chép"}
      </button>
    </div>
  );
}

// ─── VietQR payment panel ──────────────────────────────────────────────────

function VietQrPanel({ feeAssignmentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    parentApi
      .createVietQrPayment(feeAssignmentId)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [feeAssignmentId]);

  if (loading) return <p className="py-6 text-center text-sm text-slate-400">Đang tạo mã VietQR...</p>;
  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border p-3" style={{ borderColor: C.outlineVariant }}>
        <img src={data.qrImageUrl} alt="Mã VietQR" className="h-52 w-52 rounded-lg object-contain" />
        <span className="text-xs font-semibold" style={{ color: C.onSurfaceVariant }}>Quét bằng app ngân hàng bất kỳ</span>
      </div>

      <div className="flex w-full flex-col gap-2">
        <CopyField label="Ngân hàng (BIN)" value={data.bankBin} />
        <CopyField label="Số tài khoản" value={data.accountNo} />
        <CopyField label="Chủ tài khoản" value={data.accountName} />
        <CopyField label="Số tiền" value={formatCurrency(data.amount)} />
        <CopyField label="Nội dung chuyển khoản" value={data.addInfo} />

        <div className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.primary }}>
          <Ms name="info" className="!text-[16px]! mt-0.5 shrink-0" />
          <span>
            Sau khi chuyển khoản, nhà trường sẽ đối soát và xác nhận khoản đóng trong thời gian sớm nhất.
            Vui lòng giữ đúng nội dung chuyển khoản để việc đối soát nhanh hơn.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── ZaloPay payment panel ─────────────────────────────────────────────────

function ZaloPayPanel({ feeAssignmentId, onPaid }) {
  const [order, setOrder] = useState(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState(null); // null | PENDING | SUCCESS | FAILED
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const pollStartedAtRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  function stopPolling() {
    clearInterval(pollRef.current);
    pollRef.current = null;
    pollStartedAtRef.current = null;
  }

  function startPolling(appTransId) {
    stopPolling();
    pollStartedAtRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartedAtRef.current >= 15 * 60 * 1000) {
        setStatus("TIMEOUT");
        stopPolling();
        return;
      }

      try {
        const res = await parentApi.getZaloPayOrderStatus(feeAssignmentId, appTransId);
        setStatus(res.data.status);
        if (res.data.status === "SUCCESS") {
          stopPolling();
          onPaid?.();
        } else if (["FAILED", "CANCELLED", "EXPIRED"].includes(res.data.status)) {
          setError(res.data.errorMessage || "Giao dịch không thành công.");
          stopPolling();
        }
      } catch (requestError) {
        setError(requestError.message || "Tạm thời chưa kiểm tra được trạng thái giao dịch.");
      }
    }, 3000);
  }

  async function handleCreateOrder() {
    setCreating(true);
    setError("");
    try {
      const res = await parentApi.createZaloPayOrder(feeAssignmentId);
      setOrder(res.data);
      setStatus("PENDING");
      startPolling(res.data.appTransId);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (status === "SUCCESS") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(5,150,105,0.15)" }}>
          <Ms name="check_circle" fill className="!text-[36px]!" style={{ color: "#059669" }} />
        </div>
        <p className="text-base font-bold" style={{ color: C.onSurface }}>Thanh toán thành công!</p>
        <p className="text-sm" style={{ color: C.onSurfaceVariant }}>Khoản phí đã được cập nhật.</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Ms name="account_balance_wallet" fill className="!text-[48px]!" style={{ color: C.secondary }} />
        <p className="max-w-sm text-sm" style={{ color: C.onSurfaceVariant }}>
          Thanh toán trực tuyến, tự động xác nhận ngay khi hoàn tất qua ứng dụng ZaloPay hoặc app ngân hàng liên kết NAPAS.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleCreateOrder}
          disabled={creating}
          className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: C.secondary }}
        >
          <Ms name="qr_code_2" className="!text-[18px]!" />
          {creating ? "Đang khởi tạo..." : "Tạo mã thanh toán ZaloPay"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-2 rounded-2xl border p-4" style={{ borderColor: C.outlineVariant }}>
        {order.qrCode ? (
          <QRCodeSVG value={order.qrCode} size={200} />
        ) : (
          <Ms name="account_balance_wallet" className="!text-[96px]!" style={{ color: C.secondary }} />
        )}
        <span className="text-xs font-semibold" style={{ color: C.onSurfaceVariant }}>
          Quét bằng ZaloPay hoặc app ngân hàng NAPAS
        </span>
      </div>

      <a
        href={order.orderUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90"
        style={{ backgroundColor: C.secondary }}
      >
        <Ms name="open_in_new" className="!text-[16px]!" />
        Mở trang thanh toán ZaloPay
      </a>

      <div className="flex items-center gap-2 text-xs" style={{ color: C.onSurfaceVariant }}>
        {["FAILED", "CANCELLED", "EXPIRED", "TIMEOUT"].includes(status) ? (
          <span className="font-semibold" style={{ color: C.error }}>
            {status === "TIMEOUT"
              ? "Chưa nhận được xác nhận sau 15 phút."
              : error || "Giao dịch thất bại hoặc đã hết hạn."}
          </span>
        ) : (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: C.secondary }} />
            Đang chờ xác nhận thanh toán...
          </>
        )}
      </div>

      {["FAILED", "CANCELLED", "EXPIRED", "TIMEOUT"].includes(status) && (
        <button
          type="button"
          onClick={() => { setOrder(null); setStatus(null); setError(""); }}
          className="text-xs font-bold hover:underline"
          style={{ color: C.primary }}
        >
          Thử lại
        </button>
      )}
    </div>
  );
}

// ─── Fee detail + payment modal ────────────────────────────────────────────

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <span style={{ color: C.onSurfaceVariant }}>{label}</span>
      <span className="col-span-2 font-medium" style={{ color: C.onSurface }}>{children}</span>
    </div>
  );
}

const PAYMENT_METHOD_LABEL = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
  ZALOPAY: "ZaloPay",
  OTHER: "Khác",
};

function FeeDetailModal({ feeAssignmentId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("vietqr");

  function load() {
    setLoading(true);
    setError("");
    parentApi
      .getFeeDetail(feeAssignmentId)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [feeAssignmentId]);

  function handlePaid() {
    load();
    onChanged?.();
  }

  const payable = detail && detail.remainingAmount > 0 && ["PUBLISHED", "LOCKED"].includes(detail.planStatus);

  return (
    <Modal open title={detail?.title || "Chi tiết khoản phí"} onClose={onClose} maxWidth="max-w-2xl">
      {loading && <p className="py-8 text-center text-sm text-slate-400">Đang tải...</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!loading && detail && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <DetailRow label="Học sinh">{detail.studentFullName} ({detail.studentCode}){detail.className ? ` · ${detail.className}` : ""}</DetailRow>
            <DetailRow label="Năm học">{detail.schoolYearName}{detail.semesterName ? ` · ${detail.semesterName}` : ""}</DetailRow>
            <DetailRow label="Hạn đóng">{formatDate(detail.dueDate)}</DetailRow>
            {detail.description && <DetailRow label="Mô tả">{detail.description}</DetailRow>}
            <DetailRow label="Trạng thái"><StatusBadge status={effectiveStatus(detail)} /></DetailRow>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl px-4 py-3 text-center" style={{ backgroundColor: C.surfaceLow }}>
              <p className="text-[11px] font-semibold uppercase" style={{ color: C.onSurfaceVariant }}>Phải đóng</p>
              <p className="text-base font-bold" style={{ color: C.onSurface }}>{formatCurrency(detail.finalAmount)}</p>
            </div>
            <div className="rounded-xl px-4 py-3 text-center" style={{ backgroundColor: C.surfaceLow }}>
              <p className="text-[11px] font-semibold uppercase" style={{ color: C.onSurfaceVariant }}>Đã đóng</p>
              <p className="text-base font-bold" style={{ color: "#059669" }}>{formatCurrency(detail.paidAmount)}</p>
            </div>
            <div className="rounded-xl px-4 py-3 text-center" style={{ backgroundColor: C.surfaceLow }}>
              <p className="text-[11px] font-semibold uppercase" style={{ color: C.onSurfaceVariant }}>Còn lại</p>
              <p className="text-base font-bold" style={{ color: detail.remainingAmount > 0 ? C.error : C.onSurface }}>{formatCurrency(detail.remainingAmount)}</p>
            </div>
          </div>

          {payable && (
            <div className="rounded-2xl border p-4" style={{ borderColor: C.outlineVariant }}>
              <div className="mb-4 flex w-fit items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.outlineVariant }}>
                <button
                  type="button"
                  onClick={() => setTab("vietqr")}
                  className="rounded-full px-4 py-1.5 text-sm font-bold transition-all"
                  style={tab === "vietqr" ? { backgroundColor: C.primaryContainer, color: "#fff" } : { color: C.onSurfaceVariant }}
                >
                  VietQR
                </button>
                <button
                  type="button"
                  onClick={() => setTab("zalopay")}
                  className="rounded-full px-4 py-1.5 text-sm font-bold transition-all"
                  style={tab === "zalopay" ? { backgroundColor: C.secondary, color: "#fff" } : { color: C.onSurfaceVariant }}
                >
                  ZaloPay
                </button>
              </div>

              {tab === "vietqr"
                ? <VietQrPanel key={`vietqr-${feeAssignmentId}`} feeAssignmentId={feeAssignmentId} />
                : <ZaloPayPanel key={`zalopay-${feeAssignmentId}`} feeAssignmentId={feeAssignmentId} onPaid={handlePaid} />}
            </div>
          )}

          {!payable && detail.planStatus === "CANCELLED" && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: C.surfaceLow, color: C.onSurfaceVariant }}>
              <Ms name="block" className="!text-[18px]!" />
              Khoản phí này đã bị hủy, bạn không cần thanh toán.
            </div>
          )}

          {!payable && detail.planStatus !== "CANCELLED" && detail.remainingAmount <= 0 && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: "rgba(5,150,105,0.1)", color: "#059669" }}>
              <Ms name="task_alt" className="!text-[18px]!" />
              Khoản phí này đã được đóng đủ.
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>
              Lịch sử thanh toán {detail.payments?.length ? `(${detail.payments.length})` : ""}
            </p>
            {!detail.payments?.length ? (
              <p className="text-sm text-slate-400">Chưa có giao dịch nào.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {detail.payments.map((p) => (
                  <div key={p.paymentId} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: C.surfaceLow }}>
                    <div>
                      <span className="font-semibold" style={{ color: C.onSurface }}>{formatCurrency(p.amount)}</span>
                      <span className="ml-2" style={{ color: C.onSurfaceVariant }}>
                        {PAYMENT_METHOD_LABEL[p.paymentMethod] || p.paymentMethod} · {formatDate(p.paymentDate)}
                      </span>
                    </div>
                    {p.transactionCode && (
                      <span className="text-xs" style={{ color: C.onSurfaceVariant }}>#{p.transactionCode}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

const TABLE_COLS = [
  { label: "Khoản phí", align: "text-left" },
  { label: "Học sinh", align: "text-left" },
  { label: "Hạn đóng", align: "text-left" },
  { label: "Phải đóng", align: "text-right" },
  { label: "Còn lại", align: "text-right" },
  { label: "Trạng thái", align: "text-center" },
  { label: "", align: "text-right" },
];

function ParentStudentFees() {
  const { user } = useAuth();
  const { students, loading: studentsLoading } = useParentStudents();

  const [studentFilter, setStudentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedFeeId, setSelectedFeeId] = useState(null);

  const hookParams = useMemo(
    () => ({ studentId: studentFilter || undefined, status: statusFilter || undefined }),
    [studentFilter, statusFilter],
  );

  const { data: items, loading, error, refetch } = useParentStudentFees(hookParams);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, row) => {
        acc.paid += row.paidAmount;

        // A cancelled fee plan no longer needs to be paid — its outstanding
        // balance shouldn't count toward what the parent still owes.
        if (row.planStatus !== "CANCELLED") {
          acc.total += row.finalAmount;
          acc.remaining += row.remainingAmount;
          if (row.remainingAmount > 0 && row.status !== "WAIVED") acc.unpaidCount += 1;
        }
        return acc;
      },
      { total: 0, paid: 0, remaining: 0, unpaidCount: 0 },
    );
  }, [items]);

  const headerUser = useMemo(() => {
    const role = user?.roles?.find((r) => r.roleName === "PARENT");
    return {
      name: user?.fullName ?? user?.username ?? "Phụ huynh",
      role: role?.description ?? "Phụ huynh",
      avatar: user?.avatar ?? "",
    };
  }, [user]);

  const summaryCards = [
    { label: "TỔNG PHẢI ĐÓNG", value: formatCurrency(totals.total), iconName: "receipt_long", accent: C.deepBlue },
    { label: "ĐÃ ĐÓNG", value: formatCurrency(totals.paid), iconName: "task_alt", accent: "#059669" },
    { label: "CÒN LẠI", value: formatCurrency(totals.remaining), iconName: "hourglass_empty", accent: C.primaryContainer },
    { label: "KHOẢN CHƯA ĐÓNG", value: String(totals.unpaidCount), caption: "khoản cần thanh toán", iconName: "warning", accent: C.error },
  ];

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      <div className="flex flex-col gap-6">
        {!studentsLoading && students.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStudentFilter("")}
              className="rounded-xl px-4 py-2 text-sm font-medium transition"
              style={
                studentFilter === ""
                  ? { backgroundColor: C.deepBlue, color: "#fff" }
                  : { border: `1px solid ${C.outlineVariant}`, backgroundColor: "#fff", color: C.onSurfaceVariant }
              }
            >
              Tất cả con
            </button>
            {students.map((s) => (
              <button
                key={s.studentId}
                type="button"
                onClick={() => setStudentFilter(String(s.studentId))}
                className="rounded-xl px-4 py-2 text-sm font-medium transition"
                style={
                  studentFilter === String(s.studentId)
                    ? { backgroundColor: C.deepBlue, color: "#fff" }
                    : { border: `1px solid ${C.outlineVariant}`, backgroundColor: "#fff", color: C.onSurfaceVariant }
                }
              >
                {s.studentFullName}
                {s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold" style={{ color: C.onSurface }}>Học phí</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-4xl bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ backgroundColor: "#EEEEEE" }}>
            <Ms name="filter_list" className="!text-[18px]!" style={{ color: C.onSurfaceVariant }} />
            <span className="text-xs font-bold" style={{ color: C.onSurface }}>Bộ lọc:</span>
          </div>

          <PrettySelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="cursor-pointer rounded-full border bg-white px-4 py-2 text-sm outline-none focus:ring-1"
            style={{ borderColor: C.outlineVariant, color: C.onSurface }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </PrettySelect>
        </div>

        {error && (
          <div className="rounded-4xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((n) => <div key={n} className="h-14 animate-pulse rounded-4xl bg-slate-200/60" />)}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-hidden rounded-4xl border bg-white" style={{ borderColor: C.outlineVariant, boxShadow: CARD_SHADOW }}>
            {items.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-400">Chưa có khoản học phí nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                    <tr>
                      {TABLE_COLS.map((col) => (
                        <th key={col.label} className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${col.align}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: C.outlineVariant }}>
                    {items.map((row) => (
                      <tr
                        key={row.feeAssignmentId}
                        onClick={() => setSelectedFeeId(row.feeAssignmentId)}
                        className="cursor-pointer transition-colors hover:bg-[#F3F3F3]"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium" style={{ color: C.onSurface }}>{row.title}</p>
                          <p className="text-xs" style={{ color: C.onSurfaceVariant }}>{row.feeType}</p>
                        </td>
                        <td className="px-6 py-4" style={{ color: C.onSurfaceVariant }}>
                          {row.studentFullName}
                          {row.className && <span className="ml-1 text-xs opacity-70">· {row.className}</span>}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4" style={{ color: C.onSurfaceVariant }}>
                          {formatDate(row.dueDate)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium" style={{ color: C.onSurface }}>
                          {formatCurrency(row.finalAmount)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold" style={{ color: row.planStatus === "CANCELLED" ? C.onSurfaceVariant : row.remainingAmount > 0 ? C.error : "#059669" }}>
                          {row.planStatus === "CANCELLED" ? "—" : formatCurrency(row.remainingAmount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <StatusBadge status={effectiveStatus(row)} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            title="Xem chi tiết"
                            onClick={(e) => { e.stopPropagation(); setSelectedFeeId(row.feeAssignmentId); }}
                            className="rounded-full p-2 transition-colors hover:bg-[#EEEEEE]"
                            style={{ color: C.onSurfaceVariant }}
                          >
                            <Ms name="visibility" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedFeeId && (
        <FeeDetailModal
          feeAssignmentId={selectedFeeId}
          onClose={() => setSelectedFeeId(null)}
          onChanged={refetch}
        />
      )}
    </DashboardShell>
  );
}

export default ParentStudentFees;
