import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiFile,
  FiImage,
  FiMessageSquare,
  FiPaperclip,
  FiSearch,
  FiSend,
  FiTrash2,
  FiUserPlus,
  FiUsers,
  FiX,
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

function hasConversationHistory(conversation) {
  return Boolean(
    conversation.lastContent ||
      conversation.lastType ||
      conversation.lastSentAt ||
      conversation.lastMessageAt ||
      conversation.lastMessageId ||
      conversation.unreadCount > 0,
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
      <div
        className={`flex max-w-[86%] flex-col sm:max-w-[72%] ${
          isMine ? "items-end" : "items-start"
        }`}
      >
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
  onSent,
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

  if (!conversationId) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-orange-100 bg-white p-6 text-center shadow-sm sm:min-h-[520px] xl:min-h-[680px]">
        <div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
            <FiMessageSquare size={28} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[460px] flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm sm:min-h-[620px] xl:min-h-[680px]">
      <div className="flex items-center justify-between border-b border-orange-100 bg-white px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <ConversationAvatar
            name={chatName}
            tone={isGroup ? "green" : "orange"}
          />

          <div className="min-w-0">
            <h3 className="mb-1 truncate text-base font-bold text-[#0F2747] sm:text-xl">
              {chatName}
            </h3>

            <p className="mb-0 text-xs text-slate-500">
              {chatSubtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] px-3 py-4 sm:px-6 sm:py-5">
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
        className="border-t border-orange-100 bg-white px-3 py-3 sm:px-5 sm:py-4"
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

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center !rounded-full border border-orange-100 bg-[#FFF7F2] text-[#F27123] transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="h-12 min-w-0 flex-1 !rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
          />

          <button
            type="submit"
            disabled={submitting || (!content.trim() && !selectedFile)}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center gap-2 !rounded-full bg-[#F27123] px-0 text-sm font-bold text-white shadow-lg shadow-orange-200/70 transition hover:-translate-y-0.5 hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-5"
          >
            <FiSend size={16} />
            <span className="hidden sm:inline">{submitting ? "Đang gửi..." : "Gửi"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function NewConversationModal({
  open,
  onClose,
  groups,
  teachers,
  teacherSearch,
  setTeacherSearch,
  onOpenGroup,
  onStartTeacher,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 py-6">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden !rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-end px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-50 hover:text-red-600"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-3 sm:px-6">
          <div className="mb-6">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
              Nhóm
            </p>

            {groups.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {groups.map((group) => (
                  <div key={group.conversationId}>
                    <button
                      type="button"
                      onClick={() => onOpenGroup(group)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-orange-200 hover:bg-[#FFF7F2]"
                    >
                      <ConversationAvatar
                        name={group.title}
                        tone="green"
                      />

                      <div className="min-w-0">
                        <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                          {group.title}
                        </p>

                        <p className="mb-0 truncate text-xs text-slate-500">
                          <FiUsers className="mr-1 inline" />
                          {group.memberCount} thành viên
                        </p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                Chưa có nhóm lớp hoặc nhóm nội trú.
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="mb-0 text-xs font-black uppercase tracking-wide text-slate-400">
                Giáo viên
              </p>

              <div className="relative w-full md:w-72">
                <FiSearch
                  size={15}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={teacherSearch}
                  onChange={(event) => setTeacherSearch(event.target.value)}
                  placeholder="Tìm giáo viên..."
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
            </div>

            {teachers.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {teachers.map((teacher) => {
                  const roleLabel = teacher.isHomeroom
                    ? "Giáo viên chủ nhiệm"
                    : "Giáo viên bộ môn";

                  const subjectLabel =
                    teacher.subjects.length > 0
                      ? ` · ${teacher.subjects.join(", ")}`
                      : "";

                  return (
                    <div key={teacher.teacherUserId || teacher.teacherName}>
                      <button
                        type="button"
                        onClick={() => onStartTeacher(teacher)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-orange-200 hover:bg-[#FFF7F2]"
                      >
                        <ConversationAvatar
                          name={teacher.teacherName}
                          tone="blue"
                        />

                        <div className="min-w-0">
                          <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                            {teacher.teacherName}
                          </p>

                          <p className="mb-0 truncate text-xs text-slate-500">
                            {roleLabel}
                            {subjectLabel}
                          </p>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                Không tìm thấy giáo viên phù hợp.
              </div>
            )}
          </div>
        </div>
      </div>
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
  const [showNewConversation, setShowNewConversation] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [contactsResponse, conversationsResponse] = await Promise.all([
        studentApi.getMessageContacts(),
        studentApi.listConversations({
          archived: false,
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

  const groups = contacts?.groups || [];

  const visibleConversations = useMemo(
    () => conversations.filter(hasConversationHistory),
    [conversations],
  );

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
      setShowNewConversation(false);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function openConversation(conversation) {
    setActiveConversationId(conversation.conversationId);
    setSelectedConversation(conversation);
  }

  function openGroupConversation(group) {
    openConversation({
      ...group,
      conversationType: "GROUP",
      displayName: group.title,
      title: group.title,
    });

    setShowNewConversation(false);
  }

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <StudentDashboardShell context={context}>
      {loading && <LoadingState label="Đang tải tin nhắn..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được tin nhắn: ${error}`} />
      )}

      {!loading && !error && (
        <>
          <div className="grid gap-3 xl:grid-cols-[minmax(300px,0.46fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(320px,0.38fr)_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm xl:min-h-[680px]">
                <div className="px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative min-w-0 flex-1">
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

                    <button
                      type="button"
                      onClick={() => setShowNewConversation(true)}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center !rounded-full bg-[#F27123] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#d95f17]"
                      title="Tạo cuộc trò chuyện mới"
                      aria-label="Tạo cuộc trò chuyện mới"
                    >
                      <FiUserPlus size={19} />
                    </button>
                  </div>
                </div>

                <div className="max-h-[360px] overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 xl:h-[575px] xl:max-h-none">
                  {visibleConversations.length > 0 ? (
                    <div className="space-y-2">
                      {visibleConversations.map((conversation) => (
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
                    <div className="flex h-full items-center justify-center px-4 text-center">
                      <div>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
                          <FiMessageSquare size={24} />
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowNewConversation(true)}
                          className="inline-flex items-center gap-2 !rounded-full bg-[#F27123] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#d95f17]"
                        >
                          <FiUserPlus size={16} />
                          Tạo cuộc trò chuyện
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </aside>

            <ThreadPanel
              conversationId={activeConversationId}
              selectedConversation={selectedConversation}
              onSent={refresh}
            />
          </div>

          <NewConversationModal
            open={showNewConversation}
            onClose={() => setShowNewConversation(false)}
            groups={groups}
            teachers={filteredTeachers}
            teacherSearch={teacherSearch}
            setTeacherSearch={setTeacherSearch}
            onOpenGroup={openGroupConversation}
            onStartTeacher={startTeacherConversation}
          />
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentMessages;