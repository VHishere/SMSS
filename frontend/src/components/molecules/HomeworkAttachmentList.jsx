import FilePreviewLink from "../atoms/FilePreviewLink";

function HomeworkAttachmentList({ attachments = [] }) {
  if (!attachments.length) {
    return (
      <p className="mb-0 text-sm text-slate-500">
        Bài tập chưa có tệp đính kèm.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((item) => (
        <FilePreviewLink
          key={item.attachmentId || item.fileUrl}
          fileName={item.fileName}
          fileUrl={item.fileUrl}
          fileType={item.fileType}
        />
      ))}
    </div>
  );
}

export default HomeworkAttachmentList;