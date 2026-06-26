import {
  useMemo,
  useState,
} from "react";

import {
  FiMessageSquare,
  FiSearch,
  FiSend,
  FiUsers,
} from "react-icons/fi";

import { studentApi } from "../../api/client";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";

import EmptyState from "../../components/molecules/EmptyState";

import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

import { useAuth } from "../../context/useAuth";
import {
  useStudentMessages,
  useStudentThread,
} from "../../hooks/useStudentMessages";

function getInitials(name) {
  if (!name) return "?";

  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function ConversationAvatar({
  name,
  avatar,
  tone = "orange",
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-[#08509F]"
      : "bg-[#FFE7D6] text-[#F27123]";

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name || "Avatar"}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className={`
        flex h-12 w-12 shrink-0
        items-center justify-center
        rounded-full text-sm font-bold
        ${toneClass}
      `}
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

  const normalizedValue = String(value).replace(" ", "T");
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getMessageDateKey(value) {
  const date = parseMessageDate(value);

  if (!date) return "unknown";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatMessageDate(value) {
  const date = parseMessageDate(value);

  if (!date) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatMessageTime(value) {
  const date = parseMessageDate(value);

  if (!date) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MessageDateDivider({
  date,
}) {
  return (
    <div className="flex justify-center">
      <span
        className="
          rounded-full bg-white px-4 py-1.5
          text-xs font-semibold text-slate-500
          shadow-sm
        "
      >
        {formatMessageDate(date)}
      </span>
    </div>
  );
}

function TeacherList({
  contacts,
  activeTeacherUserId,
  search,
  onSearchChange,
  onStart,
}) {
  const teachers = contacts?.teachers || [];

  const uniqueTeachers = useMemo(
    () => getUniqueTeachers(teachers),
    [teachers],
  );

  const filteredTeachers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return uniqueTeachers;

    return uniqueTeachers.filter((teacher) => {
      const name = teacher.teacherName || "";
      const subjects = teacher.subjects?.join(" ") || "";

      return `${name} ${subjects}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [
    uniqueTeachers,
    search,
  ]);

  return (
    <aside
      className="
        min-h-[650px] overflow-hidden
        rounded-3xl border border-orange-100
        bg-white shadow-sm
      "
    >
      <div className="px-5 pt-5 pb-3">
        <div className="relative">
          <FiSearch
            size={16}
            className="
              absolute left-4 top-1/2
              -translate-y-1/2 text-slate-400
            "
          />

          <input
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Tìm giáo viên..."
            className="
              h-11 w-full rounded-full
              border border-slate-200
              bg-slate-50 pl-11 pr-4
              text-sm text-[#0F2747]
              outline-none transition
              focus:border-[#F27123]
              focus:bg-white
              focus:ring-4 focus:ring-orange-100
            "
          />
        </div>
      </div>

      <div className="h-[560px] overflow-y-auto px-3 py-3">
        {filteredTeachers.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState title="Không tìm thấy giáo viên" />
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTeachers.map((teacher) => {
              const active =
                activeTeacherUserId === teacher.teacherUserId;

              const roleLabel = teacher.isHomeroom
                ? "Giáo viên chủ nhiệm"
                : "Giáo viên bộ môn";

              const subjectLabel =
                teacher.subjects.length > 0
                  ? ` · ${teacher.subjects.join(", ")}`
                  : "";

              return (
                <button
                  key={
                    teacher.teacherUserId ||
                    teacher.teacherId ||
                    teacher.teacherName
                  }
                  type="button"
                  onClick={() => onStart(teacher)}
                  className={`
                    flex w-full items-center gap-3
                    rounded-2xl px-3 py-3
                    text-left transition
                    ${
                      active
                        ? "bg-[#FFF7F2]"
                        : "hover:bg-slate-50"
                    }
                  `}
                >
                  <ConversationAvatar
                    name={teacher.teacherName}
                    avatar={teacher.avatar}
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
        )}
      </div>
    </aside>
  );
}

function MessageBubble({
  message,
  isMine,
}) {
  return (
    <div
      className={`
        flex w-full
        ${isMine ? "justify-end" : "justify-start"}
      `}
    >
      <div
        className={`
          flex max-w-[72%] flex-col
          ${isMine ? "items-end" : "items-start"}
        `}
      >
        <div
          className={`
            rounded-2xl px-4 py-3
            text-sm shadow-sm
            ${
              isMine
                ? "rounded-br-md bg-[#F27123] text-white"
                : "rounded-bl-md bg-white text-[#0F2747]"
            }
          `}
        >
          <p className="mb-0 whitespace-pre-wrap leading-6">
            {message.isDeleted
              ? "Tin nhắn đã được thu hồi"
              : message.content || "[Tệp đính kèm]"}
          </p>
        </div>

        <p
          className={`
            mt-1 mb-0 text-[11px]
            ${
              isMine
                ? "text-right text-slate-400"
                : "text-left text-slate-400"
            }
          `}
        >
          {formatMessageTime(message.sentAt)}
        </p>
      </div>
    </div>
  );
}

function ThreadPanel({
  conversationId,
  selectedTeacher,
  onSent,
}) {
  const { user } = useAuth();

  const [refreshKey, setRefreshKey] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState("");

  const {
    data,
    loading,
    error,
  } = useStudentThread(conversationId, refreshKey);

  const messages = data?.messages || [];

  async function sendMessage(event) {
    event.preventDefault();

    if (!conversationId || !content.trim()) return;

    setSubmitting(true);
    setSendError("");

    try {
      await studentApi.sendMessage(conversationId, {
        messageType: "TEXT",
        content,
      });

      setContent("");
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
      <div
        className="
          flex min-h-[650px] items-center
          justify-center rounded-3xl
          border border-dashed border-orange-200
          bg-white p-8 text-center
        "
      >
        <div>
          <div
            className="
              mx-auto mb-4 flex h-16 w-16
              items-center justify-center
              rounded-full bg-[#FFF7F2]
              text-[#F27123]
            "
          >
            <FiMessageSquare size={28} />
          </div>

          <p className="mb-1 text-base font-bold text-[#0F2747]">
            Chọn giáo viên để nhắn tin
          </p>

          <p className="mb-0 text-sm text-slate-500">
            Nội dung trò chuyện sẽ hiển thị tại đây.
          </p>
        </div>
      </div>
    );
  }

  const chatName =
    selectedTeacher?.teacherName ||
    data?.meta?.title ||
    "Cuộc trò chuyện";

  const chatSubtitle =
    selectedTeacher?.isHomeroom
      ? "Giáo viên chủ nhiệm"
      : selectedTeacher?.subjects?.length
        ? `Giáo viên bộ môn · ${selectedTeacher.subjects.join(", ")}`
        : "Giáo viên";

  return (
    <div
      className="
        flex min-h-[650px] flex-col
        overflow-hidden rounded-3xl
        border border-orange-100
        bg-white shadow-sm
      "
    >
      <div
        className="
          flex items-center justify-between
          border-b border-orange-100
          bg-white px-6 py-4
        "
      >
        <div className="flex items-center gap-3">
          <ConversationAvatar
            name={chatName}
            avatar={selectedTeacher?.avatar}
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
      </div>

      <div
        className="
          flex-1 space-y-4 overflow-y-auto
          bg-[#F8FAFC] px-6 py-5
        "
      >
        {loading && (
          <LoadingState label="Đang tải tin nhắn..." />
        )}

        {!loading && error && (
          <ErrorAlert error={error} />
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title="Chưa có tin nhắn"
              description="Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện."
            />
          </div>
        )}

        {!loading &&
          !error &&
          messages.map((message, index) => {
            const isMine =
              message.senderId === user?.userId;

            const currentDateKey =
              getMessageDateKey(message.sentAt);

            const previousDateKey =
              index > 0
                ? getMessageDateKey(messages[index - 1].sentAt)
                : null;

            const shouldShowDate =
              index === 0 || currentDateKey !== previousDateKey;

            return (
              <div
                key={message.messageId}
                className="space-y-3"
              >
                {shouldShowDate && (
                  <MessageDateDivider date={message.sentAt} />
                )}

                <MessageBubble
                  message={message}
                  isMine={isMine}
                />
              </div>
            );
          })}
      </div>

      <form
        onSubmit={sendMessage}
        className="
          border-t border-orange-100
          bg-white px-5 py-4
        "
      >
        {sendError && (
          <p className="mb-3 text-sm text-red-600">
            {sendError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <input
            value={content}
            onChange={(event) =>
              setContent(event.target.value)
            }
            placeholder="Nhập tin nhắn..."
            className="
              h-12 min-w-0 flex-1 rounded-full
              border border-slate-200
              bg-slate-50 px-5
              text-sm text-[#0F2747]
              outline-none transition
              focus:border-[#F27123]
              focus:bg-white
              focus:ring-4 focus:ring-orange-100
            "
          />

          <button
            type="submit"
            disabled={submitting || !content.trim()}
            style={{
              borderRadius: "9999px",
            }}
            className="
              inline-flex h-12 items-center
              justify-center gap-2
              bg-[#F27123] px-5
              text-sm font-bold text-white
              shadow-lg shadow-orange-200/70
              transition hover:-translate-y-0.5
              hover:bg-[#d95f17]
              hover:shadow-xl hover:shadow-orange-200
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <FiSend size={16} />
            Gửi
          </button>
        </div>
      </form>
    </div>
  );
}

function StudentMessages() {
  const [refreshKey, setRefreshKey] = useState(0);

  const [activeConversationId, setActiveConversationId] =
    useState(null);

  const [selectedTeacher, setSelectedTeacher] =
    useState(null);

  const [teacherSearch, setTeacherSearch] =
    useState("");

  const [startingError, setStartingError] = useState("");

  const {
    contacts,
    loading,
    error,
  } = useStudentMessages(refreshKey);

  const context = contacts?.context;

  async function startConversation(teacher) {
    setStartingError("");
    setSelectedTeacher(teacher);

    try {
      const response =
        await studentApi.startConversation(teacher.teacherUserId);

      setActiveConversationId(
        response.data.conversationId,
      );

      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setStartingError(requestError.message);
    }
  }

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <StudentDashboardShell context={context}>
      {loading && (
        <LoadingState label="Đang tải danh sách giáo viên..." />
      )}

      {!loading && error && (
        <ErrorAlert error={`Không tải được tin nhắn: ${error}`} />
      )}

      {!loading && !error && (
        <>
          {startingError && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
              {startingError}
            </div>
          )}

          <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <TeacherList
              contacts={contacts}
              activeTeacherUserId={selectedTeacher?.teacherUserId}
              search={teacherSearch}
              onSearchChange={setTeacherSearch}
              onStart={startConversation}
            />

            <ThreadPanel
              conversationId={activeConversationId}
              selectedTeacher={selectedTeacher}
              onSent={refresh}
            />
          </section>
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentMessages;