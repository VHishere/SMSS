import { useRef, useState } from "react";
import { FiFile, FiPaperclip, FiTrash2, FiUploadCloud } from "react-icons/fi";

import { homeworkApi } from "../../api/client";

/**
 * Reusable file upload field.
 * - Uploads each picked file immediately to the homework attachment endpoint.
 * - `value` is an array of { attachmentId, fileName, fileUrl, fileType }.
 * - Calls onChange(nextValue) whenever the list changes.
 *
 * onRemove(attachment) is optional — when provided (edit mode on a saved
 * homework) it is called so the parent can DELETE the persisted attachment;
 * otherwise the item is just removed from local state (create/draft mode).
 */
function FileUploadField({ value = [], onChange, onRemove, disabled = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg,  setErrorMsg]  = useState("");

  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;

    setUploading(true);
    setErrorMsg("");

    try {
      const uploaded = [];
      for (const file of files) {
        const res = await homeworkApi.uploadAttachment(file);
        uploaded.push(res.data);
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove(item) {
    if (onRemove) {
      await onRemove(item);
    } else {
      onChange(value.filter((v) => v.attachmentId !== item.attachmentId));
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 text-sm transition disabled:opacity-50"
        style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}
      >
        <FiUploadCloud size={24} style={{ color: "#F27123" }} />
        {uploading ? (
          <span>Đang tải lên...</span>
        ) : (
          <>
            <span className="font-medium">Nhấn để chọn tệp đính kèm</span>
            <span className="text-xs text-slate-400">
              PDF, Word, Excel, ảnh, zip · tối đa 10MB
            </span>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {errorMsg && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {errorMsg}
        </p>
      )}

      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((item) => (
            <li
              key={item.attachmentId}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}
            >
              <FiFile size={15} style={{ color: "#08509F" }} className="shrink-0" />
              <a
                href={item.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-medium"
                style={{ color: "#08509F" }}
              >
                {item.fileName}
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(item)}
                  className="shrink-0 text-slate-400 transition hover:text-red-600"
                  aria-label="Xóa tệp"
                >
                  <FiTrash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {value.length === 0 && !uploading && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <FiPaperclip size={12} />
          Chưa có tệp đính kèm.
        </p>
      )}
    </div>
  );
}

export default FileUploadField;
