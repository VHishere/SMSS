import Modal from "./Modal";

function ConfirmModal({
  open,
  title = "Xác nhận",
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "default",
  loading = false,
  onConfirm,
  onClose,
}) {
  const confirmButtonClass =
    tone === "danger"
      ? "bg-[#BA1A1A] hover:bg-[#a11616]"
      : "bg-[#00458E] hover:bg-[#003b78]";

  return (
    <Modal open={open} title={title} onClose={onClose} maxWidth="max-w-sm">
      <p className="text-sm text-slate-600">{message}</p>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmButtonClass}`}
        >
          {loading ? "Đang xử lý..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
