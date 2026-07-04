import { FiExternalLink, FiFile, FiImage } from "react-icons/fi";

function isImageFile(fileType, fileName = "", fileUrl = "") {
  const lower = `${fileType || ""} ${fileName} ${fileUrl}`.toLowerCase();

  return (
    lower.includes("image/") ||
    /\.(png|jpe?g|webp|gif)$/i.test(lower)
  );
}

function FilePreviewLink({
  fileName = "Tệp đính kèm",
  fileUrl,
  fileType,
  compact = false,
  className = "",
}) {
  if (!fileUrl) {
    return null;
  }

  const image = isImageFile(fileType, fileName, fileUrl);
  const Icon = image ? FiImage : FiFile;

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      className={`
        inline-flex max-w-full items-center gap-2
        rounded-xl border border-orange-100 bg-white
        font-semibold text-[#08509F]
        transition hover:border-orange-200 hover:bg-[#FFF7F2]
        ${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}
        ${className}
      `}
    >
      <Icon className="shrink-0" size={compact ? 14 : 16} />
      <span className="min-w-0 truncate">
        {fileName || "Tệp đính kèm"}
      </span>
      <FiExternalLink className="shrink-0" size={compact ? 13 : 15} />
    </a>
  );
}

export default FilePreviewLink;