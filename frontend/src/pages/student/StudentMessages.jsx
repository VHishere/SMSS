import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiArchive,
  FiFile,
  FiImage,
  FiInbox,
  FiMessageSquare,
  FiPaperclip,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";

import { studentApi } from "../../api/client";
import ErrorAlert from "../../components/atoms/ErrorAlert";
import FilePreviewLink from "../../components/atoms/FilePreviewLink";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useAuth } from "../../context/useAuth";
import { useStudentThread } from "../../hooks/useStudentMessages";

function getInitials(name) {
  if (!name) return "?";

  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function ConversationAvatar({ name, tone = "orange" }) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-[#08509F]"
      : tone === "green"
        ? "bg-green-50 text-green-700"
        : "bg-[#FFE7D6] text-[#F27123]";

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toneClass}`}
    >
      {getInitials(name)}
    </div>
  );
}

function getUniqueTeachers(teachers = []) {
  const map = new Map();

  teachers.forEach((teacher) => {
    const key =
      teacher.teacherUserId ||
      teacher.teacherId ||
      teacher.teacherName;

    if (!map.has(key)) {
      map.set(key, {
        ...teacher,
        subjects: [],
        isHomeroom:
          teacher.roleInClass === "HOMEROOM_TEACHER",
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
  });

  return Array.from(map.values());
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
          className="max-h-72 max-w-full rounded-2xl object-contain"
        />
      </a>
    );
  }

  return (
    <div className="mt-2">
      <FilePreviewLink
        compact
        fileName={message.content || "Tệp đính kèm"}
        fileUrl={message.fileUrl}
        className={
          isMine
            ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
            : ""
        }
      />
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  isGroup,
}) {
  const hasText = Boolean(message.content);

  return (
    <div className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[72%] flex-col ${isMine ? "items-end" : "items-start"}`}>
        {isGroup && !isMine && (
          <p className="mb-1 text-xs font-bold text-slate-500">
            {message.senderName}
          </p>
        )}

        <div
          className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
            isMine
              ? "rounded-br-md bg-[#F27123] text-white"
              : "rounded-bl-md bg-white text-[#0F2747]"
          }`}
        >
          {message.isDeleted ? (
            <p className="mb-0 italic opacity-80">
              Tin nhắn đã được thu hồi
            </p>
          ) : (
            <>
              {hasText && (
                <p className="mb-0 whitespace-pre-wrap leading-6">
                  {message.content}
                </p>
              )}

              {!hasText && message.fileUrl && (
                <p className="mb-0 flex items-center gap-2 font-semibold">
                  {message.messageType === "IMAGE" ? <FiImage /> : <FiFile />}
                  Tệp đính kèm
                </p>
              )}

              <MessageAttachment
                message={message}
                isMine={isMine}
              />
            </>
          )}
        </div>

        <p className="mt-1 mb-0 text-[11px] text-slate-400">
          {formatMessageTime(message.sentAt)}
        </p>
      </div>
    </div>
  );
}

function SelectedFilePreview({ file, onClear }) {
  if (!file) return null;

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-[#FFF7F2] px-4 py-3 text-sm text-[#0F2747]">
      <div className="flex min-w-0 items-center gap-2">
        {file.type?.startsWith("image/") ? (
          <FiImage className="shrink-0 text-[#F27123]" />
        ) : (
          <FiFile className="shrink-0 text-[#F27123]" />
        )}

        <span className="min-w-0 truncate font-semibold">
          {file.name}
        </span>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-slate-400 transition hover:text-red-600"
        aria-label="Bỏ file"
      >
        <FiTrash2 size={16} />
      </button>
    </div>
  );
}

function ThreadPanel({
  conversationId,
  selectedConversation,
  archived,
  onSent,
  onArchiveChanged,
}) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState("");

  const {
    data,
    loading,
    error,
  } = useStudentThread(conversationId, refreshKey);

  const messages = data?.messages || [];
  const participants = data?.participants || [];
  const meta = data?.meta;

  const isGroup =
    meta?.conversationType === "GROUP" ||
    selectedConversation?.conversationType === "GROUP";

  const otherParticipant = participants.find(
    (participant) => Number(participant.userId) !== Number(user?.userId),
  );

  const chatName =
    selectedConversation?.title ||
    selectedConversation?.displayName ||
    meta?.title ||
    otherParticipant?.fullName ||
    "Cuộc trò chuyện";

  const chatSubtitle = isGroup
    ? "Nhóm trò chuyện"
    : "Tin nhắn trực tiếp";

  async function sendMessage(event) {
    event.preventDefault();

    if (!conversationId || (!content.trim() && !selectedFile)) {
      return;
    }

    setSubmitting(true);
    setSendError("");

    try {
      if (selectedFile) {
        const uploadResponse = await studentApi.uploadMessageFile(selectedFile);
        const uploaded = uploadResponse.data;

        await studentApi.sendMessage(conversationId, {
          messageType: uploaded.messageType,
          content: content.trim() || uploaded.fileName,
          fileUrl: uploaded.fileUrl,
        });
      } else {
        await studentApi.sendMessage(conversationId, {
          messageType: "TEXT",
          content: content.trim(),
        });
      }

      setContent("");
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setRefreshKey((key) => key + 1);
      onSent();
    } catch (requestError) {
      setSendError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    await studentApi.archiveConversation(conversationId, !archived);
    onArchiveChanged();
  }

  if (!conversationId) {
    return (
      <div className="flex min-h-[650px] items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
            <FiMessageSquare size={28} />
          </div>

          <p className="mb-1 text-base font-bold text-[#0F2747]">
            Chọn cuộc trò chuyện
          </p>

          <p className="mb-0 text-sm text-slate-500">
            Tin nhắn với giáo viên, nhóm lớp và nhóm nội trú sẽ hiển thị tại đây.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[650px] flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-orange-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <ConversationAvatar
            name={chatName}
            tone={isGroup ? "green" : "orange"}
          />

          <div>
            <h3 className="mb-1 text-xl font-bold text-[#0F2747]">
              {chatName}
            </h3>

            <p className="mb-0 text-xs text-slate-500">
              {chatSubtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleArchive}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
        >
          <FiArchive size={15} />
          {archived ? "Bỏ lưu trữ" : "Lưu trữ"}
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] px-6 py-5">
        {loading && <LoadingState label="Đang tải tin nhắn..." />}

        {!loading && error && <ErrorAlert error={error} />}

        {!loading && !error && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title="Chưa có tin nhắn"
              description="Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện."
            />
          </div>
        )}

        {!loading && !error &&
          messages.map((message) => {
            const isMine = Number(message.senderId) === Number(user?.userId);

            return (
              <MessageBubble
                key={message.messageId}
                message={message}
                isMine={isMine}
                isGroup={isGroup}
              />
            );
          })}
      </div>

      <form
        onSubmit={sendMessage}
        className="border-t border-orange-100 bg-white px-5 py-4"
      >
        {sendError && (
          <p className="mb-3 text-sm text-red-600">
            {sendError}
          </p>
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
          className="hidden"
          onChange={(event) =>
            setSelectedFile(event.target.files?.[0] || null)
          }
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-[#FFF7F2] text-[#F27123] transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Đính kèm tệp"
          >
            <FiPaperclip size={18} />
          </button>

          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              selectedFile
                ? "Ghi chú cho file đính kèm..."
                : "Nhập tin nhắn..."
            }
            className="h-12 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
          />

          <button
            type="submit"
            disabled={submitting || (!content.trim() && !selectedFile)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#F27123] px-5 text-sm font-bold text-white shadow-lg shadow-orange-200/70 transition hover:-translate-y-0.5 hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSend size={16} />
            {submitting ? "Đang gửi..." : "Gửi"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StudentMessages() {
  const [contacts, setContacts] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [context, setContext] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);

  const [teacherSearch, setTeacherSearch] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [messageSearch, setMessageSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [messageSearchError, setMessageSearchError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [contactsResponse, conversationsResponse] = await Promise.all([
        studentApi.getMessageContacts(),
        studentApi.listConversations({
          archived: showArchived,
          search: conversationSearch,
        }),
      ]);

      setContacts(contactsResponse.data);
      setContext(contactsResponse.data.context);
      setConversations(conversationsResponse.data.items || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    refreshKey,
    showArchived,
    conversationSearch,
  ]);

  const teachers = useMemo(
    () => getUniqueTeachers(contacts?.teachers || []),
    [contacts],
  );

  const filteredTeachers = useMemo(() => {
    const keyword = teacherSearch.trim().toLowerCase();

    if (!keyword) return teachers;

    return teachers.filter((teacher) => {
      const name = teacher.teacherName || "";
      const subjects = teacher.subjects?.join(" ") || "";

      return `${name} ${subjects}`.toLowerCase().includes(keyword);
    });
  }, [teachers, teacherSearch]);

  async function startTeacherConversation(teacher) {
    try {
      const response = await studentApi.startConversation(
        teacher.teacherUserId,
      );

      const conversation = {
        conversationId: response.data.conversationId,
        conversationType: "TEACHER_STUDENT",
        displayName: teacher.teacherName,
        title: teacher.teacherName,
      };

      setActiveConversationId(response.data.conversationId);
      setSelectedConversation(conversation);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function openConversation(conversation) {
    setActiveConversationId(conversation.conversationId);
    setSelectedConversation(conversation);
  }

  async function handleMessageSearch(event) {
    event.preventDefault();

    const keyword = messageSearch.trim();

    if (!keyword) {
      setSearchResults([]);
      return;
    }

    setSearchingMessages(true);
    setMessageSearchError("");

    try {
      const response = await studentApi.searchMessageHistory({
        keyword,
        archived: showArchived,
      });

      setSearchResults(response.data.items || []);
    } catch (requestError) {
      setMessageSearchError(requestError.message);
    } finally {
      setSearchingMessages(false);
    }
  }

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  function handleArchiveChanged() {
    setActiveConversationId(null);
    setSelectedConversation(null);
    refresh();
  }

  return (
    <StudentDashboardShell context={context}>
      {loading && <LoadingState label="Đang tải tin nhắn..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được tin nhắn: ${error}`} />
      )}

      {!loading && !error && (
        <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <aside className="min-h-[650px] overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
            <div className="border-b border-orange-100 px-5 py-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="mb-0 text-xl font-black text-[#0F2747]">
                  Tin nhắn
                </h2>

                <button
                  type="button"
                  onClick={refresh}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-50 hover:text-[#F27123]"
                >
                  <FiRefreshCw size={17} />
                </button>
              </div>

              <div className="mb-3 flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition ${
                    !showArchived
                      ? "bg-white text-[#F27123] shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  <FiInbox className="mr-1 inline" />
                  Đang mở
                </button>

                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition ${
                    showArchived
                      ? "bg-white text-[#F27123] shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  <FiArchive className="mr-1 inline" />
                  Lưu trữ
                </button>
              </div>

              <div className="relative">
                <FiSearch
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={conversationSearch}
                  onChange={(event) =>
                    setConversationSearch(event.target.value)
                  }
                  placeholder="Tìm cuộc trò chuyện..."
                  className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
            </div>

            <div className="h-[560px] overflow-y-auto px-4 py-4">
              <form
                onSubmit={handleMessageSearch}
                className="mb-4"
              >
                <div className="relative">
                  <FiSearch
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={messageSearch}
                    onChange={(event) =>
                      setMessageSearch(event.target.value)
                    }
                    placeholder="Tìm trong lịch sử tin nhắn..."
                    className="h-11 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:ring-4 focus:ring-orange-100"
                  />
                </div>
              </form>

              {messageSearchError && (
                <p className="mb-3 text-sm text-red-600">
                  {messageSearchError}
                </p>
              )}

              {searchingMessages && (
                <p className="mb-3 text-sm text-slate-500">
                  Đang tìm kiếm...
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#08509F]">
                    Kết quả tìm kiếm
                  </p>

                  <div className="space-y-2">
                    {searchResults.map((item) => (
                      <button
                        key={item.messageId}
                        type="button"
                        onClick={() =>
                          openConversation({
                            conversationId: item.conversationId,
                            conversationType: item.conversationType,
                            title: item.displayName,
                            displayName: item.displayName,
                          })
                        }
                        className="w-full rounded-xl bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                      >
                        <p className="mb-1 font-bold text-[#0F2747]">
                          {item.displayName}
                        </p>

                        <p className="mb-0 line-clamp-2 text-xs text-slate-500">
                          {item.senderName}: {item.content || item.fileUrl}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
                  Nhóm
                </p>

                {contacts?.groups?.length > 0 ? (
                  <div className="space-y-2">
                    {contacts.groups.map((group) => (
                      <button
                        key={group.conversationId}
                        type="button"
                        onClick={() => openConversation(group)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          activeConversationId === group.conversationId
                            ? "bg-[#FFF7F2]"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <ConversationAvatar
                          name={group.title}
                          tone="green"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                            {group.title}
                          </p>

                          <p className="mb-0 truncate text-xs text-slate-500">
                            <FiUsers className="mr-1 inline" />
                            {group.memberCount} thành viên
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mb-0 text-sm text-slate-500">
                    Chưa có nhóm lớp hoặc nhóm nội trú.
                  </p>
                )}
              </div>

              <div className="mb-5">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
                  Cuộc trò chuyện
                </p>

                {conversations.length > 0 ? (
                  <div className="space-y-2">
                    {conversations.map((conversation) => (
                      <button
                        key={conversation.conversationId}
                        type="button"
                        onClick={() => openConversation(conversation)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          activeConversationId === conversation.conversationId
                            ? "bg-[#FFF7F2]"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <ConversationAvatar
                          name={conversation.displayName}
                          tone={
                            conversation.conversationType === "GROUP"
                              ? "green"
                              : "orange"
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                              {conversation.displayName}
                            </p>

                            {conversation.unreadCount > 0 && (
                              <span className="rounded-full bg-[#F27123] px-2 py-0.5 text-[11px] font-bold text-white">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>

                          <p className="mb-0 truncate text-xs text-slate-500">
                            {conversation.lastType === "IMAGE"
                              ? "Ảnh đính kèm"
                              : conversation.lastType === "FILE"
                                ? "Tệp đính kèm"
                                : conversation.lastContent || "Chưa có tin nhắn"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={
                      showArchived
                        ? "Chưa có cuộc trò chuyện lưu trữ"
                        : "Chưa có cuộc trò chuyện"
                    }
                  />
                )}
              </div>

              {!showArchived && (
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
                    Giáo viên
                  </p>

                  <div className="relative mb-3">
                    <FiSearch
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={teacherSearch}
                      onChange={(event) =>
                        setTeacherSearch(event.target.value)
                      }
                      placeholder="Tìm giáo viên..."
                      className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />
                  </div>

                  <div className="space-y-2">
                    {filteredTeachers.map((teacher) => {
                      const roleLabel = teacher.isHomeroom
                        ? "Giáo viên chủ nhiệm"
                        : "Giáo viên bộ môn";

                      const subjectLabel =
                        teacher.subjects.length > 0
                          ? ` · ${teacher.subjects.join(", ")}`
                          : "";

                      return (
                        <button
                          key={teacher.teacherUserId || teacher.teacherName}
                          type="button"
                          onClick={() => startTeacherConversation(teacher)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                        >
                          <ConversationAvatar
                            name={teacher.teacherName}
                            tone="blue"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                              {teacher.teacherName}
                            </p>

                            <p className="mb-0 truncate text-xs text-slate-500">
                              {roleLabel}
                              {subjectLabel}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <ThreadPanel
            conversationId={activeConversationId}
            selectedConversation={selectedConversation}
            archived={showArchived}
            onSent={refresh}
            onArchiveChanged={handleArchiveChanged}
          />
        </section>
      )}
    </StudentDashboardShell>
  );
}

export default StudentMessages;