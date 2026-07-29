import { FiDownload, FiFile, FiImage } from "react-icons/fi";

function getFileIcon(fileType = "", fileName = "") {
  const normalized = `${fileType} ${fileName}`.toLowerCase();
  return normalized.includes("image") || /\.(png|jpe?g|gif|webp)$/i.test(fileName)
    ? FiImage
    : FiFile;
}

function HomeworkAttachmentList({ attachments = [] }) {
  if (!attachments.length) {
    return (
      <p className="mb-0 text-xs text-slate-500">
        Bài tập chưa có tệp đính kèm.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {attachments.map((item) => {
        const Icon = getFileIcon(item.fileType, item.fileName);

        return (
          <a
            key={item.attachmentId || item.fileUrl}
            href={item.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-inherit no-underline transition hover:border-orange-200 hover:bg-orange-50/40"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-orange-50 text-[#F27123]">
              <Icon size={18} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-extrabold text-[#0F2747]">
                {item.fileName || "Tài liệu đính kèm"}
              </span>
              <span className="mt-1 block text-[10px] text-slate-400">
                Nhấn để mở tài liệu
              </span>
            </span>

            <FiDownload className="shrink-0 text-slate-400 transition group-hover:text-[#F27123]" />
          </a>
        );
      })}
    </div>
  );
}

export default HomeworkAttachmentList;