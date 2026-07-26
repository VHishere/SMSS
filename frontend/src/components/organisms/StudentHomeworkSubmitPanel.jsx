import { useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiFile,
  FiLink,
  FiSend,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

function formatFileSize(size) {
  if (!size) return "";

  const kb = size / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function StudentHomeworkSubmitPanel({
  disabled = false,
  disabledReason = "",
  defaultContent = "",
  isResubmission = false,
  onSubmit,
}) {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [link, setLink] = useState(defaultContent || "");
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function selectFile(selectedFile) {
    if (!selectedFile) return;

    setFile(selectedFile);
    setError("");
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    if (disabled || submitting) return;

    selectFile(event.dataTransfer.files?.[0]);
  }

  function removeFile() {
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (disabled) {
      return;
    }

    if (!file && !link.trim()) {
      setError(
        "Vui lòng chọn tệp hoặc nhập đường dẫn bài làm.",
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onSubmit({
        content: link.trim(),
        file,
      });

      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (requestError) {
      setError(
        requestError.message || "Nộp bài thất bại.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="
        rounded-2xl border border-slate-200
        bg-white p-5 shadow-sm
      "
    >
      <h3 className="mb-4 text-xl font-black text-[#0F2747]">
        Nộp bài
      </h3>

      {error && (
        <p
          className="
            mb-4 rounded-xl border border-red-100 bg-red-50
            px-4 py-3 text-sm font-semibold leading-6 text-red-600
          "
        >
          {error}
        </p>
      )}

      {disabled && (
        <div
          className="
            mb-4 flex items-start gap-3 rounded-xl
            border border-amber-200 bg-amber-50
            px-4 py-3 text-amber-800
          "
        >
          <FiAlertCircle
            className="mt-0.5 shrink-0"
            size={18}
          />

          <p className="mb-0 text-sm font-semibold leading-6">
            {disabledReason ||
              "Bài tập hiện không cho phép nộp hoặc cập nhật bài."}
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        disabled={disabled || submitting}
        className="hidden"
        onChange={(event) =>
          selectFile(event.target.files?.[0])
        }
      />

      {!file ? (
        <button
          type="button"
          disabled={disabled || submitting}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`
            mb-4 flex min-h-40 w-full flex-col items-center
            justify-center rounded-xl border border-dashed
            px-4 py-6 text-center transition
            disabled:cursor-not-allowed disabled:opacity-55
            ${
              dragging
                ? "border-[#F27123] bg-orange-50"
                : "border-slate-300 bg-slate-50 hover:border-orange-300 hover:bg-orange-50/50"
            }
          `}
        >
          <span
            className="
              mb-3 grid h-11 w-11 place-items-center rounded-full
              bg-white text-[#F27123] shadow-sm
            "
          >
            <FiUploadCloud size={21} />
          </span>

          <strong className="text-sm text-[#0F2747]">
            Kéo thả tệp vào đây
          </strong>

          <span className="mt-1 text-xs text-slate-400">
            hoặc nhấn để chọn tệp từ máy tính
          </span>
        </button>
      ) : (
        <div
          className="
            mb-4 rounded-xl border border-emerald-100
            bg-emerald-50 p-4
          "
        >
          <div className="flex items-center gap-3">
            <span
              className="
                grid h-11 w-11 shrink-0 place-items-center
                rounded-lg bg-white text-emerald-600
              "
            >
              <FiFile size={19} />
            </span>

            <div className="min-w-0 flex-1">
              <p
                className="
                  mb-1 flex items-center gap-1.5 truncate
                  text-sm font-extrabold text-[#0F2747]
                "
              >
                <FiCheckCircle className="shrink-0 text-emerald-600" />
                {file.name}
              </p>

              <p className="mb-0 text-xs text-slate-500">
                {formatFileSize(file.size)} · Sẵn sàng để nộp
              </p>
            </div>

            <button
              type="button"
              onClick={removeFile}
              disabled={disabled || submitting}
              className="
                grid h-8 w-8 shrink-0 place-items-center rounded-full
                text-slate-400 transition
                hover:bg-red-50 hover:text-red-600
              "
              aria-label="Xóa tệp đã chọn"
            >
              <FiTrash2 size={15} />
            </button>
          </div>
        </div>
      )}

      <label className="mb-4 block">
        <span
          className="
            mb-2 flex items-center gap-1.5
            text-xs font-extrabold uppercase
            tracking-wide text-slate-500
          "
        >
          <FiLink />
          Link bài làm (Drive/Website)
        </span>

        <input
          type="url"
          value={link}
          disabled={disabled || submitting}
          onChange={(event) => {
            setLink(event.target.value);
            setError("");
          }}
          placeholder="https://docs.google.com/..."
          className="
            h-11 w-full rounded-xl border border-slate-200
            px-3 text-sm text-slate-700 outline-none transition
            placeholder:text-slate-400
            focus:border-orange-300 focus:ring-2
            focus:ring-orange-100 disabled:bg-slate-100
          "
        />
      </label>

      <button
        type="submit"
        disabled={
          disabled ||
          submitting ||
          (!file && !link.trim())
        }
        className="
          inline-flex h-11 w-full items-center justify-center
          gap-2 rounded-xl bg-[#F27123] px-5
          text-sm font-extrabold text-white shadow-sm transition
          hover:bg-[#d95f17]
          disabled:cursor-not-allowed disabled:bg-slate-300
        "
      >
        <FiSend />

        {submitting
          ? "Đang nộp..."
          : isResubmission
            ? "Cập nhật bài nộp"
            : "Nộp bài"}
      </button>
    </form>
  );
}

export default StudentHomeworkSubmitPanel;