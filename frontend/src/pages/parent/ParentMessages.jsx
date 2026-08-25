import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiCheck,
  FiEdit3,
  FiFile,
  FiImage,
  FiInfo,
  FiMessageSquare,
  FiPaperclip,
  FiPhone,
  FiSearch,
  FiSend,
  FiTrash2,
  FiUsers,
  FiVideo,
  FiX,
} from "react-icons/fi";

import { parentApi } from "../../api/client";
import ErrorAlert from "../../components/atoms/ErrorAlert";
import FilePreviewLink from "../../components/atoms/FilePreviewLink";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentThread } from "../../hooks/useParentMessages";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";
import {
  emitSocketWithAck,
  getChatSocket,
} from "../../socket/chatSocket";

const CONVERSATION_FILTERS = [
  { value: "ALL", label: "Tất cả" },
  { value: "TEACHER", label: "Giáo viên" },
  { value: "GROUP", label: "Nhóm" },
  { value: "UNREAD", label: "Chưa đọc" },
];

const MAX_MESSAGE_LENGTH = 5000;
const MAX_MESSAGE_FILE_SIZE = 20 * 1024 * 1024;
const MESSAGE_FILE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".txt",
  ".csv",
]);
const MESSAGE_FILE_ACCEPT = [...MESSAGE_FILE_EXTENSIONS].join(",");

function getFileExtension(fileName = "") {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : "";
}

function validateMessageFile(file) {
  if (!file) return "";

  if (file.size > MAX_MESSAGE_FILE_SIZE) {
    return "Tệp đính kèm không được vượt quá 20 MB.";
  }

  if (!MESSAGE_FILE_EXTENSIONS.has(getFileExtension(file.name))) {
    return "Định dạng tệp không được hỗ trợ.";
  }

  return "";
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function getInitials(name) {
  if (!name) return "?";

  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function parseMessageDate(value) {
  if (!value) return null;

  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMessageTime(value) {
  const date = parseMessageDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatConversationTime(value) {
  const date = parseMessageDate(value);
  if (!date) return "";

  const now = new Date();
  const difference = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);

  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getMessageDateKey(value) {
  const date = parseMessageDate(value);
  if (!date) return "";

  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatMessageDateLabel(value) {
  const date = parseMessageDate(value);
  if (!date) return "";

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const dateStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDifference = Math.round(
    (todayStart.getTime() - dateStart.getTime()) / 86400000,
  );

  if (dayDifference === 0) return "HÔM NAY";
  if (dayDifference === 1) return "HÔM QUA";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function hasConversationHistory(conversation) {
  return Boolean(
    conversation.lastContent ||
      conversation.lastType ||
      conversation.lastSentAt ||
      conversation.lastMessageAt ||
      conversation.lastMessageId ||
      Number(conversation.unreadCount) > 0,
  );
}

function appendUniqueMessage(messages = [], message) {
  if (!message?.messageId) return messages;

  const exists = messages.some(
    (item) => Number(item.messageId) === Number(message.messageId),
  );

  if (exists) {
    return messages.map((item) =>
      Number(item.messageId) === Number(message.messageId)
        ? { ...item, ...message }
        : item,
    );
  }

  return [...messages, message];
}

function getUniqueTeachers(teachers = []) {
  const map = new Map();

  teachers.forEach((teacher) => {
    const key = `${teacher.teacherUserId || teacher.teacherId || teacher.teacherName}:${teacher.studentId}`;

    if (!map.has(key)) {
      map.set(key, {
        ...teacher,
        subjects: [],
        students: [],
        isHomeroom: teacher.roleInClass === "HOMEROOM_TEACHER",
      });
    }

    const current = map.get(key);

    if (teacher.roleInClass === "HOMEROOM_TEACHER") {
      current.isHomeroom = true;
    }

    if (
      teacher.subjectName &&
      !current.subjects.includes(teacher.subjectName)
    ) {
      current.subjects.push(teacher.subjectName);
    }

    if (
      teacher.studentName &&
      !current.students.includes(teacher.studentName)
    ) {
      current.students.push(teacher.studentName);
    }
  });

  return Array.from(map.values());
}

function getTeacherSubtitle(teacher) {
  if (!teacher) return "Giáo viên";

  const base = teacher.isHomeroom
    ? teacher.subjects?.length
      ? `Giáo viên chủ nhiệm · ${teacher.subjects.join(", ")}`
      : "Giáo viên chủ nhiệm"
    : teacher.subjects?.length
      ? `Giáo viên · ${teacher.subjects.join(", ")}`
      : "Giáo viên";

  return teacher.students?.length
    ? `${base} · HS: ${teacher.students.join(", ")}`
    : base;
}

function getMessageSummary(conversation) {
  if (conversation.lastIsDeleted) return "Tin nhắn đã được thu hồi";
  if (conversation.lastType === "IMAGE") return "Đã gửi một hình ảnh";
  if (conversation.lastType === "FILE") return "Đã gửi một tệp đính kèm";
  return conversation.lastContent || "";
}

function getConversationPreview(conversation, currentUserId) {
  const summary = getMessageSummary(conversation);
  if (!summary) return "Chưa có tin nhắn";

  if (Number(conversation.lastSenderId) === Number(currentUserId)) {
    return `Bạn: ${summary}`;
  }

  // Hội thoại 1-1: tên đối phương đã nằm ngay trên dòng tiêu đề, lặp lại ở đây
  // chỉ tốn chỗ. Nhóm thì cần, vì tiêu đề là tên nhóm chứ không phải tên người.
  if (conversation.conversationType !== "GROUP") return summary;

  return conversation.lastSenderName
    ? `${conversation.lastSenderName}: ${summary}`
    : summary;
}

function ConversationAvatar({
  name,
  src,
  tone = "orange",
  size = "md",
  className = "",
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const sizeClass =
    size === "sm"
      ? "h-8 w-8 text-[10px]"
      : size === "lg"
        ? "h-12 w-12 text-sm"
        : "h-10 w-10 text-xs";

  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-[#0756A3]"
      : tone === "green"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-[#FFF0E6] text-[#F27123]";

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name || "Ảnh đại diện"}
        onError={() => setImageFailed(true)}
        className={`${sizeClass} shrink-0 rounded-full border border-slate-200 bg-white object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${toneClass} flex shrink-0 items-center justify-center rounded-full font-extrabold ${className}`}
      aria-label={name || "Ảnh đại diện"}
    >
      {getInitials(name)}
    </div>
  );
}

function MessageAttachment({ message, isMine }) {
  if (!message.fileUrl || message.isDeleted) return null;

  if (message.messageType === "IMAGE") {
    return (
      <a
        href={message.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block"
      >
        <img
          src={message.fileUrl}
          alt={message.content || "Ảnh đính kèm"}
          className="max-h-72 max-w-full rounded-xl object-contain"
        />
      </a>
    );
  }

  return (
    <div className={message.content ? "" : "mt-1"}>
      <FilePreviewLink
        compact
        fileName={message.content || "Tệp đính kèm"}
        fileUrl={message.fileUrl}
        className={
          isMine
            ? "border-white/35 bg-white/10 text-white hover:bg-white/20"
            : "border-slate-200 bg-white text-[#0F2747]"
        }
      />
    </div>
  );
}

function MessageDateSeparator({ sentAt }) {
  const dateLabel = formatMessageDateLabel(sentAt);
  if (!dateLabel) return null;

  return (
    <div className="flex items-center justify-center py-2">
      <span className="rounded-full bg-[#F1F2F4] px-3 py-1 text-[10px] font-bold tracking-wide text-slate-500">
        {dateLabel}
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  isGroup,
  onRecall,
  avatarSrc,
}) {
  const showText = Boolean(
    message.content &&
      (message.messageType === "TEXT" || message.messageType === "IMAGE"),
  );

  return (
    <div
      className={`flex w-full items-end gap-2 ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      {!isMine && (
        <ConversationAvatar
          name={message.senderName}
          src={avatarSrc}
          tone="blue"
          size="sm"
          className="mb-5"
        />
      )}

      <div
        className={`group flex max-w-[86%] flex-col sm:max-w-[72%] ${
          isMine ? "items-end" : "items-start"
        }`}
      >
        {isGroup && !isMine && (
          <p className="mb-1 text-[11px] font-bold text-slate-500">
            {message.senderName}
          </p>
        )}

        <div
          className={`px-4 py-3 text-sm shadow-sm ${
            isMine
              ? "rounded-[16px] rounded-br-[5px] bg-[#0757A6] text-white"
              : "rounded-[16px] rounded-bl-[5px] bg-[#ECEDEF] text-[#172033]"
          }`}
        >
          {message.isDeleted ? (
            <p className="mb-0 italic opacity-75">
              Tin nhắn đã được thu hồi
            </p>
          ) : (
            <>
              {showText && (
                <p className="mb-0 whitespace-pre-wrap break-words leading-6">
                  {message.content}
                </p>
              )}

              {!message.content && message.fileUrl && (
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  {message.messageType === "IMAGE" ? <FiImage /> : <FiFile />}
                  Tệp đính kèm
                </p>
              )}

              <MessageAttachment message={message} isMine={isMine} />
            </>
          )}
        </div>

        <div
          className={`mt-1 flex min-h-4 items-center gap-1.5 text-[10px] text-slate-400 ${
            isMine ? "justify-end" : "justify-start"
          }`}
        >
          <span>{formatMessageTime(message.sentAt)}</span>

          {isMine && !message.isDeleted && (
            <span
              className={`inline-flex items-center gap-0.5 ${
                message.receipt === "READ"
                  ? "font-semibold text-[#F27123]"
                  : "text-slate-400"
              }`}
            >
              <FiCheck size={11} />
              {message.receipt === "READ" ? "Đã đọc" : "Đã gửi"}
            </span>
          )}

          {isMine && !message.isDeleted && (
            <button
              type="button"
              onClick={() => onRecall(message.messageId)}
              className="hidden text-slate-300 transition hover:text-red-500 group-hover:inline-flex"
              title="Thu hồi tin nhắn"
              aria-label="Thu hồi tin nhắn"
            >
              <FiTrash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectedFilePreview({ file, onClear }) {
  if (!file) return null;

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-[#FFF7F2] px-4 py-3 text-sm text-[#0F2747]">
      <div className="flex min-w-0 items-center gap-2">
        {file.type?.startsWith("image/") ? (
          <FiImage className="shrink-0 text-[#F27123]" />
        ) : (
          <FiFile className="shrink-0 text-[#F27123]" />
        )}

        <span className="min-w-0 truncate font-semibold">{file.name}</span>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-slate-400 transition hover:text-red-600"
        aria-label="Bỏ tệp"
      >
        <FiX size={17} />
      </button>
    </div>
  );
}

function ThreadPanel({
  conversationId,
  selectedConversation,
  onConversationChanged,
  onConversationRead,
}) {
  const { user } = useAuth();

  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState([]);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const { data, setData, loading, error, reload } =
    useParentThread(conversationId);

  const messages = data?.messages || [];
  const participants = useMemo(
    () => data?.participants || [],
    [data?.participants],
  );
  const meta = data?.meta;

  const isGroup =
    meta?.conversationType === "GROUP" ||
    selectedConversation?.conversationType === "GROUP";

  const otherParticipant = participants.find(
    (participant) => Number(participant.userId) !== Number(user?.userId),
  );

  const chatName = isGroup
    ? selectedConversation?.title ||
      selectedConversation?.displayName ||
      meta?.title ||
      "Nhóm trò chuyện"
    : otherParticipant?.fullName ||
      selectedConversation?.displayName ||
      selectedConversation?.title ||
      meta?.title ||
      "Cuộc trò chuyện";

  const chatAvatar = isGroup ? "" : selectedConversation?.avatar || "";

  const typingNames = useMemo(
    () =>
      participants
        .filter((participant) =>
          typingUserIds.includes(Number(participant.userId)),
        )
        .map((participant) => participant.fullName)
        .filter(Boolean),
    [participants, typingUserIds],
  );

  const renderedMessages = useMemo(() => {
    const keyword = normalizeText(messageSearch);
    if (!keyword) return messages;

    return messages.filter((message) =>
      normalizeText(message.content).includes(keyword),
    );
  }, [messageSearch, messages]);

  const markConversationRead = useCallback(() => {
    if (!conversationId) return Promise.resolve();

    return emitSocketWithAck("conversation:read", { conversationId }).catch(
      () => {},
    );
  }, [conversationId]);

  useEffect(() => {
    setMessageSearch("");
    setShowMessageSearch(false);
    setShowInfo(false);
    setSendError("");
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return undefined;

    const socket = getChatSocket();

    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit("conversation:join", { conversationId }, () => {});
    };

    const handleDisconnect = () => setSocketConnected(false);
    const handleConnectError = () => setSocketConnected(false);

    const handleNewMessage = (message) => {
      if (Number(message.conversationId) !== Number(conversationId)) return;

      setData((current) => {
        if (!current) return current;

        return {
          ...current,
          messages: appendUniqueMessage(current.messages, message),
        };
      });

      if (Number(message.senderId) !== Number(user?.userId)) {
        // Đang mở hội thoại thì tin đến cũng là đã đọc. Phải đợi server ghi nhận
        // xong mới làm mới danh sách, nếu không danh sách đọc trước và badge
        // chưa đọc lại hiện lên.
        onConversationRead?.(conversationId);
        markConversationRead().finally(() => onConversationChanged?.());
        return;
      }

      onConversationChanged?.();
    };

    const handleReadReceipt = ({
      conversationId: receiptConversationId,
      userId: readerId,
      readAt,
    }) => {
      if (
        Number(receiptConversationId) !== Number(conversationId) ||
        Number(readerId) === Number(user?.userId)
      ) {
        return;
      }

      const readTime = parseMessageDate(readAt)?.getTime();
      if (!readTime) return;

      setData((current) => {
        if (!current) return current;

        return {
          ...current,
          messages: current.messages.map((message) => {
            if (Number(message.senderId) !== Number(user?.userId)) {
              return message;
            }

            const sentTime = parseMessageDate(message.sentAt)?.getTime();
            if (!sentTime || sentTime > readTime) return message;

            return { ...message, receipt: "READ" };
          }),
        };
      });
    };

    const handleDeletedMessage = ({
      conversationId: deletedConversationId,
      messageId,
    }) => {
      if (Number(deletedConversationId) !== Number(conversationId)) return;

      setData((current) => {
        if (!current) return current;

        return {
          ...current,
          messages: current.messages.map((message) =>
            Number(message.messageId) === Number(messageId)
              ? {
                  ...message,
                  isDeleted: true,
                  content: null,
                  fileUrl: null,
                }
              : message,
          ),
        };
      });

      onConversationChanged?.();
    };

    const handleTypingStart = ({
      conversationId: typingConversationId,
      userId: typingUserId,
    }) => {
      if (
        Number(typingConversationId) !== Number(conversationId) ||
        Number(typingUserId) === Number(user?.userId)
      ) {
        return;
      }

      setTypingUserIds((current) =>
        current.includes(Number(typingUserId))
          ? current
          : [...current, Number(typingUserId)],
      );
    };

    const handleTypingStop = ({
      conversationId: typingConversationId,
      userId: typingUserId,
    }) => {
      if (Number(typingConversationId) !== Number(conversationId)) return;

      setTypingUserIds((current) =>
        current.filter((currentId) => currentId !== Number(typingUserId)),
      );
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("message:new", handleNewMessage);
    socket.on("message:read", handleReadReceipt);
    socket.on("message:deleted", handleDeletedMessage);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    if (socket.connected) handleConnect();

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      socket.emit("typing:stop", { conversationId });
      socket.emit("conversation:leave", { conversationId });

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("message:new", handleNewMessage);
      socket.off("message:read", handleReadReceipt);
      socket.off("message:deleted", handleDeletedMessage);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [
    conversationId,
    markConversationRead,
    onConversationChanged,
    onConversationRead,
    setData,
    user?.userId,
  ]);

  useEffect(() => {
    if (!scrollContainerRef.current || messageSearch.trim()) return;

    scrollContainerRef.current.scrollTop =
      scrollContainerRef.current.scrollHeight;
  }, [messages.length, conversationId, messageSearch]);

  // Mở hội thoại là đã đọc. getThread đã dời mốc last_read_at ở server, nên ở
  // đây chỉ cần báo "đã xem" cho người kia và xoá badge chưa đọc ở danh sách bên
  // trái — danh sách chỉ tải lại theo refreshKey nên không tự sạch.
  useEffect(() => {
    if (!conversationId || loading || error) return;
    markConversationRead();
    onConversationRead?.(conversationId);
  }, [conversationId, error, loading, markConversationRead, onConversationRead]);

  function handleContentChange(event) {
    const nextContent = event.target.value.slice(0, MAX_MESSAGE_LENGTH);
    setContent(nextContent);
    setSendError("");

    if (!conversationId) return;

    const socket = getChatSocket();

    if (nextContent.trim()) {
      socket.emit("typing:start", { conversationId });

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        socket.emit("typing:stop", { conversationId });
      }, 1200);
    } else {
      socket.emit("typing:stop", { conversationId });
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    const validationError = validateMessageFile(file);

    if (validationError) {
      setSelectedFile(null);
      setSendError(validationError);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setSendError("");
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (
      !conversationId ||
      !socketConnected ||
      (!content.trim() && !selectedFile)
    ) {
      return;
    }

    if (content.trim().length > MAX_MESSAGE_LENGTH) {
      setSendError(`Tin nhắn không được vượt quá ${MAX_MESSAGE_LENGTH} ký tự.`);
      return;
    }

    const fileError = validateMessageFile(selectedFile);
    if (fileError) {
      setSendError(fileError);
      return;
    }

    setSubmitting(true);
    setSendError("");

    try {
      let payload = {
        conversationId,
        messageType: "TEXT",
        content: content.trim(),
        fileUrl: null,
      };

      if (selectedFile) {
        const uploadResponse =
          await parentApi.uploadMessageFile(selectedFile);
        const uploaded = uploadResponse.data;

        payload = {
          conversationId,
          messageType: uploaded.messageType,
          content: content.trim() || uploaded.fileName,
          fileUrl: uploaded.fileUrl,
        };
      }

      const sentMessage = await emitSocketWithAck("message:send", payload);

      setData((current) => {
        if (!current) return current;

        return {
          ...current,
          messages: appendUniqueMessage(current.messages, sentMessage),
        };
      });

      setContent("");
      setSelectedFile(null);

      const socket = getChatSocket();
      socket.emit("typing:stop", { conversationId });

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      onConversationChanged?.();
    } catch (requestError) {
      setSendError(requestError.message || "Không gửi được tin nhắn");
    } finally {
      setSubmitting(false);
    }
  }

  async function recallMessage(messageId) {
    const confirmed = window.confirm(
      "Bạn có chắc muốn thu hồi tin nhắn này?",
    );

    if (!confirmed) return;

    try {
      await emitSocketWithAck("message:delete", { messageId });
    } catch (requestError) {
      setSendError(requestError.message || "Không thu hồi được tin nhắn");
      reload();
    }
  }

  if (!conversationId) {
    return (
      <section className="flex min-h-[520px] min-w-0 flex-col bg-white lg:min-h-0">
        <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
          <div>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF5FC] text-[#0757A6]">
              <FiMessageSquare size={28} />
            </div>

            <h3 className="mb-2 text-base font-bold text-[#0F2747]">
              Chưa chọn cuộc trò chuyện
            </h3>

            <p className="mb-0 text-sm text-slate-500">
              Chọn một cuộc trò chuyện ở bên trái để bắt đầu nhắn tin.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex min-h-[560px] min-w-0 flex-col bg-white lg:min-h-0">
      <header className="flex min-h-[70px] items-center justify-between border-b border-[#F1E4DC] bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <ConversationAvatar
              name={chatName}
              src={chatAvatar}
              tone={isGroup ? "green" : "blue"}
              size="md"
            />
            <span
              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                socketConnected ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
          </div>

          <div className="min-w-0">
            <h3 className="mb-0.5 truncate text-sm font-extrabold text-[#172033] sm:text-base">
              {chatName}
            </h3>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setShowMessageSearch((current) => !current);
              setShowInfo(false);
            }}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
              showMessageSearch
                ? "bg-[#EEF5FC] text-[#0757A6]"
                : "text-[#0F2747] hover:bg-slate-100"
            }`}
            title="Tìm trong cuộc trò chuyện"
            aria-label="Tìm trong cuộc trò chuyện"
          >
            <FiSearch size={17} />
          </button>

          <button
            type="button"
            disabled
            className="hidden h-9 w-9 cursor-not-allowed items-center justify-center rounded-full text-[#0F2747] opacity-45 sm:inline-flex"
            title="Chức năng gọi thoại chưa được triển khai"
            aria-label="Gọi thoại chưa được hỗ trợ"
          >
            <FiPhone size={17} />
          </button>

          <button
            type="button"
            disabled
            className="hidden h-9 w-9 cursor-not-allowed items-center justify-center rounded-full text-[#0F2747] opacity-45 sm:inline-flex"
            title="Chức năng gọi video chưa được triển khai"
            aria-label="Gọi video chưa được hỗ trợ"
          >
            <FiVideo size={18} />
          </button>
        </div>
      </header>

      {showMessageSearch && (
        <div className="border-b border-slate-100 bg-white px-4 py-3 sm:px-6">
          <div className="relative">
            <FiSearch
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              autoFocus
              value={messageSearch}
              onChange={(event) => setMessageSearch(event.target.value)}
              placeholder="Tìm nội dung tin nhắn..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-[#0F2747] outline-none transition focus:border-[#0757A6] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            {messageSearch && (
              <button
                type="button"
                onClick={() => setMessageSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                aria-label="Xóa nội dung tìm kiếm"
              >
                <FiX size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {showInfo && (
        <div className="border-b border-slate-100 bg-[#F8FAFC] px-4 py-3 text-xs text-slate-600 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>
              <strong className="text-[#0F2747]">Loại:</strong>{" "}
              {isGroup ? "Nhóm trò chuyện" : "Tin nhắn trực tiếp"}
            </span>
            <span>
              <strong className="text-[#0F2747]">Thành viên:</strong>{" "}
              {participants.length || (isGroup ? "—" : 2)}
            </span>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-3 py-4 sm:px-6 sm:py-5"
      >
        {loading && <LoadingState label="Đang tải tin nhắn..." />}

        {!loading && error && <ErrorAlert error={error} />}

        {!loading && !error && messages.length === 0 && (
          <div className="flex h-full min-h-[300px] items-center justify-center">
            <EmptyState
              title="Chưa có tin nhắn"
              description="Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện."
            />
          </div>
        )}

        {!loading &&
          !error &&
          messageSearch.trim() &&
          renderedMessages.length === 0 && (
            <div className="flex h-full min-h-[260px] items-center justify-center text-center">
              <div>
                <FiSearch
                  size={28}
                  className="mx-auto mb-3 text-slate-300"
                />
                <p className="mb-0 text-sm text-slate-500">
                  Không tìm thấy tin nhắn phù hợp.
                </p>
              </div>
            </div>
          )}

        {!loading &&
          !error &&
          renderedMessages.map((message, index) => {
            const isMine =
              Number(message.senderId) === Number(user?.userId);
            const previousMessage = renderedMessages[index - 1];
            const currentDateKey = getMessageDateKey(message.sentAt);
            const previousDateKey = getMessageDateKey(
              previousMessage?.sentAt,
            );
            const showDateSeparator =
              Boolean(currentDateKey) && currentDateKey !== previousDateKey;

            return (
              <div key={message.messageId} className="space-y-3">
                {showDateSeparator && (
                  <MessageDateSeparator sentAt={message.sentAt} />
                )}

                <MessageBubble
                  message={message}
                  isMine={isMine}
                  isGroup={isGroup}
                  onRecall={recallMessage}
                  avatarSrc={isGroup ? "" : chatAvatar}
                />
              </div>
            );
          })}
      </div>

      <form
        onSubmit={sendMessage}
        className="border-t border-slate-100 bg-white px-3 py-3 sm:px-5 sm:py-4"
      >
        {sendError && (
          <p className="mb-3 text-sm text-red-600">{sendError}</p>
        )}

        <SelectedFilePreview
          file={selectedFile}
          onClear={() => {
            setSelectedFile(null);

            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept={MESSAGE_FILE_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-[#0757A6] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Đính kèm tệp"
          >
            <FiPaperclip size={19} />
          </button>

          <input
            value={content}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={handleContentChange}
            placeholder={
              selectedFile
                ? "Ghi chú cho tệp đính kèm..."
                : "Nhập tin nhắn..."
            }
            className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-[#F5F6F7] px-5 text-sm text-[#0F2747] outline-none transition focus:border-[#0757A6] focus:bg-white focus:ring-4 focus:ring-blue-100"
          />

          <span className="hidden shrink-0 text-[10px] text-slate-400 lg:inline">
            {content.length}/{MAX_MESSAGE_LENGTH}
          </span>

          <button
            type="submit"
            disabled={
              submitting ||
              !socketConnected ||
              (!content.trim() && !selectedFile)
            }
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0757A6] text-white shadow-sm transition hover:bg-[#064A8D] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Gửi tin nhắn"
          >
            <FiSend size={17} />
          </button>
        </div>
      </form>
    </section>
  );
}

function ConversationItem({ conversation, active, onClick }) {
  const { user } = useAuth();

  const roleLabel =
    conversation.conversationType === "GROUP"
      ? "Nhóm"
      : conversation.roleLabel || "Giáo viên";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition sm:px-5 ${
        active ? "bg-[#FFF7F2]" : "bg-white hover:bg-slate-50"
      }`}
      aria-current={active ? "true" : undefined}
    >
      {active && (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-[#F27123]" />
      )}

      <ConversationAvatar
        name={conversation.displayName}
        src={conversation.avatar}
        tone={conversation.conversationType === "GROUP" ? "green" : "blue"}
        size="md"
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="mb-1 min-w-0 truncate text-[12px] font-extrabold text-[#172033] sm:text-[13px]">
            {conversation.displayName}
            <span className="font-semibold text-slate-500"> ({roleLabel})</span>
          </p>

          <span className="shrink-0 pt-0.5 text-[9px] text-slate-400">
            {formatConversationTime(conversation.lastSentAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p
            className={`mb-0 min-w-0 truncate text-[11px] ${
              Number(conversation.unreadCount) > 0
                ? "font-semibold text-[#172033]"
                : "text-slate-500"
            }`}
          >
            {getConversationPreview(conversation, user?.userId)}
          </p>

          {Number(conversation.unreadCount) > 0 && (
            <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#F27123] px-1.5 py-0.5 text-[9px] font-bold text-white">
              {Number(conversation.unreadCount) > 99
                ? "99+"
                : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function NewConversationModal({
  open,
  onClose,
  groups,
  teachers,
  searchValue,
  setSearchValue,
  onOpenGroup,
  onStartTeacher,
}) {
  if (!open) return null;

  const hasSearchKeyword = Boolean(searchValue.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[1px]">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <h3 className="mb-1 text-base font-extrabold text-[#172033]">
              Tạo cuộc trò chuyện
            </h3>
            <p className="mb-0 text-xs text-slate-500">
              Chọn nhóm phụ huynh hoặc giáo viên bạn muốn nhắn tin.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchValue("");
              onClose();
            }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
            aria-label="Đóng"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
          <div className="relative">
            <FiSearch
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              autoFocus
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Tìm nhóm hoặc giáo viên..."
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-10 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
            />

            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-[#F27123]"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <FiX size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[66vh] overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mb-7">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
              Nhóm
            </p>

            {groups.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {groups.map((group) => (
                  <button
                    key={group.conversationId}
                    type="button"
                    onClick={() => onOpenGroup(group)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-orange-200 hover:bg-[#FFF7F2]"
                  >
                    <ConversationAvatar name={group.title} tone="green" />

                    <div className="min-w-0">
                      <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                        {group.title}
                      </p>

                      <p className="mb-0 truncate text-xs text-slate-500">
                        <FiUsers className="mr-1 inline" />
                        {group.memberCount || 0} thành viên
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                {hasSearchKeyword
                  ? "Không tìm thấy nhóm phù hợp."
                  : "Chưa có nhóm phụ huynh."}
              </div>
            )}
          </div>

          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
              Giáo viên
            </p>

            {teachers.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {teachers.map((teacher) => (
                  <button
                    key={
                      teacher.teacherUserId ||
                      teacher.teacherId ||
                      teacher.teacherName
                    }
                    type="button"
                    onClick={() => onStartTeacher(teacher)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-orange-200 hover:bg-[#FFF7F2]"
                  >
                    <ConversationAvatar
                      name={teacher.teacherName}
                      src={teacher.avatar}
                      tone="blue"
                    />

                    <div className="min-w-0">
                      <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                        {teacher.teacherName}
                      </p>

                      <p className="mb-0 truncate text-xs text-slate-500">
                        {getTeacherSubtitle(teacher)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                {hasSearchKeyword
                  ? "Không tìm thấy giáo viên phù hợp."
                  : "Chưa có giáo viên để trò chuyện."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParentMessages() {
  const { user } = useAuth();
  const { students } = useParentStudents();

  const [contacts, setContacts] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [contactSearch, setContactSearch] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationFilter, setConversationFilter] = useState("ALL");
  const [showNewConversation, setShowNewConversation] = useState(false);

  const refreshConversations = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  // Trả về đúng state cũ khi không có gì thay đổi — effect đánh dấu đã đọc chạy
  // lại mỗi lần thread tải xong, tạo mảng mới mỗi lần sẽ render lại vô ích.
  const markConversationReadLocally = useCallback((conversationId) => {
    if (!conversationId) return;

    const isTarget = (conversation) =>
      Number(conversation.conversationId) === Number(conversationId) &&
      Number(conversation.unreadCount) > 0;

    setConversations((current) =>
      current.some(isTarget)
        ? current.map((conversation) =>
          isTarget(conversation)
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        )
        : current,
    );

    setSelectedConversation((current) =>
      current && isTarget(current)
        ? { ...current, unreadCount: 0 }
        : current,
    );
  }, []);

  useEffect(() => {
    const socket = getChatSocket();
    const handleConversationUpdated = () => refreshConversations();

    socket.on("conversation:updated", handleConversationUpdated);

    return () => {
      socket.off("conversation:updated", handleConversationUpdated);
    };
  }, [refreshConversations]);

  useEffect(() => {
    let isMounted = true;

    setLoading(true);

    Promise.all([
      parentApi.getMessageContacts(),
      parentApi.listConversations({
        archived: false,
        limit: 50,
      }),
    ])
      .then(([contactsResponse, conversationsResponse]) => {
        if (!isMounted) return;

        setError("");
        setContacts(contactsResponse.data);
        setConversations(conversationsResponse.data.items || []);
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message || "Không tải được tin nhắn");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const headerUser = useMemo(
    () => ({
      name: user?.fullName ?? user?.username ?? "Phụ huynh",
      role: "Phụ huynh",
      avatar: user?.avatar ?? "",
    }),
    [user],
  );

  const teachers = useMemo(
    () => getUniqueTeachers(contacts?.teachers || []),
    [contacts],
  );

  const groups = useMemo(() => contacts?.groups || [], [contacts]);

  const enrichedConversations = useMemo(
    () =>
      conversations.map((conversation) => {
        if (conversation.conversationType === "GROUP") {
          return {
            ...conversation,
            roleLabel: "Nhóm",
          };
        }

        const teacher = teachers.find(
          (item) =>
            normalizeText(item.teacherName) ===
            normalizeText(conversation.displayName || conversation.otherName),
        );

        return {
          ...conversation,
          avatar: teacher?.avatar || "",
          roleLabel: getTeacherSubtitle(teacher),
          teacherUserId: teacher?.teacherUserId,
        };
      }),
    [conversations, teachers],
  );

  const visibleConversations = useMemo(
    () => enrichedConversations.filter(hasConversationHistory),
    [enrichedConversations],
  );

  const filteredConversations = useMemo(() => {
    const keyword = normalizeText(conversationSearch);

    return visibleConversations.filter((conversation) => {
      const matchesKeyword =
        !keyword ||
        normalizeText(
          `${conversation.displayName} ${conversation.roleLabel} ${conversation.lastContent}`,
        ).includes(keyword);

      if (!matchesKeyword) return false;

      if (conversationFilter === "TEACHER") {
        return conversation.conversationType !== "GROUP";
      }

      if (conversationFilter === "GROUP") {
        return conversation.conversationType === "GROUP";
      }

      if (conversationFilter === "UNREAD") {
        return Number(conversation.unreadCount) > 0;
      }

      return true;
    });
  }, [conversationFilter, conversationSearch, visibleConversations]);

  const filteredGroups = useMemo(() => {
    const keyword = normalizeText(contactSearch);
    if (!keyword) return groups;

    return groups.filter((group) =>
      normalizeText(`${group.title} ${group.groupName}`).includes(keyword),
    );
  }, [groups, contactSearch]);

  const filteredTeachers = useMemo(() => {
    const keyword = normalizeText(contactSearch);
    if (!keyword) return teachers;

    return teachers.filter((teacher) =>
      normalizeText(
        `${teacher.teacherName} ${getTeacherSubtitle(teacher)}`,
      ).includes(keyword),
    );
  }, [teachers, contactSearch]);

  useEffect(() => {
    if (visibleConversations.length === 0) return;

    const current = visibleConversations.find(
      (conversation) =>
        Number(conversation.conversationId) === Number(activeConversationId),
    );

    if (current) {
      setSelectedConversation((previous) => ({
        ...previous,
        ...current,
      }));
      return;
    }

    if (activeConversationId) return;

    const firstConversation = visibleConversations[0];
    setActiveConversationId(firstConversation.conversationId);
    setSelectedConversation(firstConversation);
  }, [activeConversationId, visibleConversations]);

  async function startTeacherConversation(teacher) {
    try {
      const response = await parentApi.startConversation(
        teacher.teacherUserId,
        teacher.studentId,
      );

      const conversation = {
        conversationId: response.data.conversationId,
        conversationType: "PARENT_TEACHER",
        displayName: teacher.teacherName,
        title: teacher.teacherName,
        avatar: teacher.avatar || "",
        roleLabel: getTeacherSubtitle(teacher),
        teacherUserId: teacher.teacherUserId,
      };

      setActiveConversationId(response.data.conversationId);
      setSelectedConversation(conversation);
      setShowNewConversation(false);
      setContactSearch("");
      refreshConversations();
    } catch (requestError) {
      setError(requestError.message || "Không tạo được cuộc trò chuyện");
    }
  }

  function openConversation(conversation) {
    setActiveConversationId(conversation.conversationId);
    setSelectedConversation(conversation);
    // Xoá badge ngay khi bấm, không đợi thread tải xong.
    markConversationReadLocally(conversation.conversationId);
  }

  function openGroupConversation(group) {
    openConversation({
      ...group,
      conversationType: "GROUP",
      displayName: group.title,
      title: group.title,
      roleLabel: "Nhóm",
    });

    setShowNewConversation(false);
    setContactSearch("");
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {loading && !contacts && <LoadingState label="Đang tải tin nhắn..." />}

      {!loading && error && !contacts && (
        <ErrorAlert error={`Không tải được tin nhắn: ${error}`} />
      )}

      {contacts && (
        <>
          {error && (
            <div className="mb-3">
              <ErrorAlert error={`Không thể cập nhật tin nhắn: ${error}`} />
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border border-[#EEDFD7] bg-white shadow-sm lg:grid lg:h-[calc(100vh-150px)] lg:min-h-[650px] lg:max-h-[820px] lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="flex min-h-[500px] flex-col border-b border-[#EEDFD7] bg-white lg:min-h-0 lg:border-b-0 lg:border-r">
              <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
                <div className="mb-4 flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <FiSearch
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={conversationSearch}
                      onChange={(event) =>
                        setConversationSearch(event.target.value)
                      }
                      placeholder="Tìm kiếm hội thoại..."
                      className="h-9 w-full rounded-full border-0 bg-[#F4F5F6] pl-10 pr-9 text-[11px] text-[#0F2747] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-[#F27123]"
                    />

                    {conversationSearch && (
                      <button
                        type="button"
                        onClick={() => setConversationSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                        aria-label="Xóa từ khóa tìm kiếm"
                      >
                        <FiX size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <h4 className="mb-0 text-base font-extrabold text-[#172033]">
                    Tin nhắn
                  </h4>

                  <button
                    type="button"
                    onClick={() => setShowNewConversation(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F27123] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#D95F17]"
                    title="Tạo cuộc trò chuyện mới"
                    aria-label="Tạo cuộc trò chuyện mới"
                  >
                    <FiEdit3 size={17} />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {CONVERSATION_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setConversationFilter(filter.value)}
                      className={`flex min-h-11 items-center justify-center whitespace-normal break-words rounded-2xl px-1.5 py-1 text-center text-[10.5px] font-bold leading-tight transition ${
                        conversationFilter === filter.value
                          ? "bg-[#F27123] text-white"
                          : "bg-[#ECEDEF] text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredConversations.length > 0 ? (
                  filteredConversations.map((conversation) => (
                    <ConversationItem
                      key={conversation.conversationId}
                      conversation={conversation}
                      active={
                        Number(activeConversationId) ===
                        Number(conversation.conversationId)
                      }
                      onClick={() => openConversation(conversation)}
                    />
                  ))
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center px-6 text-center">
                    <div>
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF2EA] text-[#F27123]">
                        <FiMessageSquare size={21} />
                      </div>

                      <p className="mb-3 text-sm text-slate-500">
                        {conversationSearch || conversationFilter !== "ALL"
                          ? "Không có cuộc trò chuyện phù hợp."
                          : "Bạn chưa có cuộc trò chuyện nào."}
                      </p>

                      <button
                        type="button"
                        onClick={() => setShowNewConversation(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#F27123] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#D95F17]"
                      >
                        <FiEdit3 size={14} />
                        Gửi tin nhắn
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            <ThreadPanel
              conversationId={activeConversationId}
              selectedConversation={selectedConversation}
              onConversationChanged={refreshConversations}
              onConversationRead={markConversationReadLocally}
            />
          </div>

          <NewConversationModal
            open={showNewConversation}
            onClose={() => {
              setShowNewConversation(false);
              setContactSearch("");
            }}
            groups={filteredGroups}
            teachers={filteredTeachers}
            searchValue={contactSearch}
            setSearchValue={setContactSearch}
            onOpenGroup={openGroupConversation}
            onStartTeacher={startTeacherConversation}
          />
        </>
      )}
    </DashboardShell>
  );
}

export default ParentMessages;
