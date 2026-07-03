import { useRef, useState } from "react";
import {
    FiCheckCircle,
    FiFile,
    FiPaperclip,
    FiSend,
    FiTrash2,
    FiUploadCloud,
} from "react-icons/fi";

function formatFileSize(size) {
    if (!size) return "";

    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;

    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}

function StudentHomeworkSubmitPanel({
    disabled = false,
    onSubmit,
}) {
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    function handleSelectFile(event) {
        const selectedFile = event.target.files?.[0];

        if (!selectedFile) return;

        setFile(selectedFile);
        setError("");
    }

    function handleRemoveFile() {
        setFile(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!file) {
            setError("Vui lòng chọn file bài làm trước khi nộp.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await onSubmit({
                content: "",
                file,
            });

            setFile(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (requestError) {
            setError(requestError.message || "Nộp bài thất bại.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm"
        >
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7F2] text-[#F27123]">
                    <FiUploadCloud size={22} />
                </div>

                <div>
                    <h4 className="mb-1 text-xl font-black text-[#0F2747]">
                        Nộp bài tập
                    </h4>

                    <p className="mb-0 text-sm leading-6 text-slate-500">
                        Chọn file bài làm của bạn và gửi cho giáo viên.
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {error}
                </div>
            )}

            {disabled && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                    Bài tập đã đóng hoặc bài nộp đã được chấm, bạn không thể nộp lại.
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                disabled={disabled || submitting}
                className="hidden"
                onChange={handleSelectFile}
            />

            {!file && (
                <button
                    type="button"
                    disabled={disabled || submitting}
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-4 flex w-full flex-col items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-[#FFF7F2] px-5 py-7 text-center transition hover:border-[#F27123] hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#F27123] shadow-sm">
                        <FiPaperclip size={22} />
                    </div>

                    <span className="text-sm font-black text-[#F27123]">
                        Chọn file bài làm
                    </span>

                    <span className="mt-1 text-xs text-slate-500">
                        PDF, Word, ảnh, file nén hoặc các định dạng bài làm khác
                    </span>
                </button>
            )}

            {file && (
                <div className="mb-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#F27123]">
                            <FiFile size={20} />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                                <FiCheckCircle className="shrink-0 text-green-600" size={16} />

                                <p className="mb-0 truncate text-sm font-black text-[#0F2747]">
                                    {file.name}
                                </p>
                            </div>

                            <p className="mb-0 text-xs text-slate-500">
                                {formatFileSize(file.size)} · Sẵn sàng để nộp
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleRemoveFile}
                            disabled={disabled || submitting}
                            className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Xóa file"
                        >
                            <FiTrash2 size={16} />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
                {file && (
                    <button
                        type="button"
                        disabled={disabled || submitting}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 !rounded-full border border-orange-200 bg-white px-5 py-2.5 text-sm font-bold text-[#F27123] transition hover:bg-[#FFF7F2] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FiPaperclip size={16} />
                        Chọn lại
                    </button>
                )}

                <button
                    type="submit"
                    disabled={disabled || submitting || !file}
                    className="inline-flex min-w-[150px] items-center justify-center gap-2 !rounded-full border border-[#F27123] bg-[#F27123] px-7 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <FiSend size={16} />
                    {submitting ? "Đang nộp..." : "Nộp bài"}
                </button>
            </div>
        </form>
    );
}

export default StudentHomeworkSubmitPanel;