const API_BASE =
  import.meta.env.VITE_API_URL ||
  "/api";

function getAuthToken() {
  return (
    sessionStorage.getItem("smss_token") ||
    localStorage.getItem("smss_token")
  );
}

// Báo cho badge chuông ở header refetch NGAY khi có thao tác đọc thông báo.
// Header (DashboardHeader) và trang thông báo là 2 cây component tách biệt, không
// chia sẻ state — dùng window event để đồng bộ số chưa đọc tức thời (không phải
// đợi chuyển trang). Xem listener trong DashboardHeader → NotificationDropdown.
function emitNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("notifications:changed"));
  }
}

async function request(
  path,
  options = {},
) {
  const token = getAuthToken();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE}${path}`,
      {
        ...options,
        headers,
      },
    );
  } catch {
    throw new Error(
      "Không kết nối được backend. " +
      "Hãy chạy backend bằng npm run dev.",
    );
  }

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
      `Yêu cầu thất bại (${response.status})`,
    );
    error.details = data.details;
    throw error;
  }

  return data;
}

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value != null,
    ),
  );
}

export const authApi = {
  loginSchool: (email, password) =>
    request("/auth/login/school", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    }),

  loginParent: (email, password) =>
    request("/auth/login/parent", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    }),

  loginGoogleSchool: (credential) =>
    request("/auth/google/school", {
      method: "POST",
      body: JSON.stringify({
        credential,
      }),
    }),

  loginGoogleParent: (credential) =>
    request("/auth/google/parent", {
      method: "POST",
      body: JSON.stringify({
        credential,
      }),
    }),

  getMe: () => request("/auth/me"),
};

export const adminApi = {
  // UC-106: School-Wide Operations Dashboard
  getOperationsDashboard: () => request("/admin/dashboard/operations"),
  getFeesDashboard: () => request("/admin/dashboard/fees"),
  getMessagesDashboard: () => request("/admin/communication/dashboard"),

  getSchoolYears: () => request("/admin/school-years"),

  activateSchoolYear: (id) =>
    request(`/admin/school-years/${id}/activate`, { method: "PUT" }),

  evaluateSchoolYearPromotion: (id) =>
    request(`/admin/school-years/${id}/promotion/evaluate`),

  closeSchoolYear: (id) =>
    request(`/admin/school-years/${id}/close`, { method: "POST" }),

  getUsers: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/users${qs ? `?${qs}` : ""}`);
  },

  getUserStats: () => request("/admin/users/stats"),

  setUserStatus: (userId, status) =>
    request(`/admin/users/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  getRoles: () => request("/admin/roles"),

  getUserDetail: (userId) => request(`/admin/users/${userId}`),

  updateUserRoles: (userId, roleIds) =>
    request(`/admin/users/${userId}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roleIds }),
    }),

  updateUserChildren: (userId, children) =>
    request(`/admin/users/${userId}/children`, {
      method: "PUT",
      body: JSON.stringify({ children }),
    }),

  // UC-10: Manage Tuition Fee Categories
  getFeeCategories: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/fee-categories${qs ? `?${qs}` : ""}`);
  },

  createFeeCategory: (payload) =>
    request("/admin/fee-categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateFeeCategory: (id, payload) =>
    request(`/admin/fee-categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  setFeeCategoryStatus: (id, status) =>
    request(`/admin/fee-categories/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  // UC-11: Configure Fee Rates
  getFeeRates: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/fee-rates${qs ? `?${qs}` : ""}`);
  },

  createFeeRate: (payload) =>
    request("/admin/fee-rates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateFeeRate: (id, payload) =>
    request(`/admin/fee-rates/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  setFeeRateStatus: (id, status) =>
    request(`/admin/fee-rates/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  // UC-14: full online payment transaction history for a fee plan
  getFeePlanTransactions: (feePlanId) => request(`/admin/fees/${feePlanId}/transactions`),

  // Student management — school-wide 360 view (read-only mirror of the
  // teacher student-profile feature, not restricted to assigned classes).
  getStudentsMeta: () => request("/admin/students/meta"),

  getStudentsClassOverview: (classId, semesterId) => {
    const qs = new URLSearchParams({
      classId,
      ...(semesterId ? { semesterId } : {}),
    }).toString();

    return request(`/admin/students/overview?${qs}`);
  },

  getStudentProfile: (studentId, semesterId) => {
    const qs = semesterId ? `?semesterId=${semesterId}` : "";
    return request(`/admin/students/${studentId}/profile${qs}`);
  },

  getStudentAttendance: (studentId, semesterId) => {
    const qs = semesterId ? `?semesterId=${semesterId}` : "";
    return request(`/admin/students/${studentId}/attendance${qs}`);
  },

  getStudentAcademic: (studentId, semesterId) => {
    const qs = semesterId ? `?semesterId=${semesterId}` : "";
    return request(`/admin/students/${studentId}/academic${qs}`);
  },

  getStudentBehaviour: (studentId, semesterId) => {
    const qs = semesterId ? `?semesterId=${semesterId}` : "";
    return request(`/admin/students/${studentId}/behaviour${qs}`);
  },

  getStudentGoals: (studentId, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/students/${studentId}/goals${qs ? `?${qs}` : ""}`);
  },

  // Academic (điểm số) — read-only, school-wide
  getAcademicMeta: () => request("/admin/academic/meta"),

  getAcademicGradebook: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/academic/gradebook?${qs}`);
  },

  getAcademicAnalytics: (classId, semesterId) =>
    request(`/admin/academic/analytics?classId=${classId}&semesterId=${semesterId}`),

  getAcademicTrend: (classId) =>
    request(`/admin/academic/analytics/trend?classId=${classId}`),

  getAcademicWarnings: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/academic/warnings${qs ? `?${qs}` : ""}`);
  },

  // Behaviour & Conduct (hạnh kiểm) — school-wide. No evaluateConduct
  // (đánh giá hạnh kiểm) equivalent — that stays homeroom-teacher-only.
  getBehaviourMeta: () => request("/admin/behaviour/meta"),

  listBehaviourRecords: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/behaviour/records${qs ? `?${qs}` : ""}`);
  },

  createBehaviourRecord: (body) =>
    request("/admin/behaviour/records", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateBehaviourRecord: (behaviorId, body) =>
    request(`/admin/behaviour/records/${behaviorId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  archiveBehaviourRecord: (behaviorId, reason) =>
    request(`/admin/behaviour/records/${behaviorId}/archive`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Danh mục khen thưởng/vi phạm (mức độ cộng/trừ) — admin manages the point
  // value of each category; teacher's record composer reads it too.
  listBehaviourCategories: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/behaviour/categories${qs ? `?${qs}` : ""}`);
  },

  createBehaviourCategory: (body) =>
    request("/admin/behaviour/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateBehaviourCategory: (categoryId, body) =>
    request(`/admin/behaviour/categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  setBehaviourCategoryStatus: (categoryId, status) =>
    request(`/admin/behaviour/categories/${categoryId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  getConductPreview: (studentId, semesterId) =>
    request(`/admin/behaviour/conduct?studentId=${studentId}&semesterId=${semesterId}`),

  getBehaviourAnalytics: (classId, semesterId) =>
    request(`/admin/behaviour/analytics?classId=${classId}&semesterId=${semesterId}`),

  getBehaviourWarnings: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/behaviour/warnings${qs ? `?${qs}` : ""}`);
  },

  generateBehaviourWarnings: (classId, semesterId) =>
    request("/admin/behaviour/warnings/generate", {
      method: "POST",
      body: JSON.stringify({ classId, semesterId }),
    }),

  updateBehaviourWarning: (warningId, body) =>
    request(`/admin/behaviour/warnings/${warningId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Attendance (điểm danh) — school-wide history/stats + class summary/warnings
  getAttendanceMeta: () => request("/admin/attendance/meta"),

  getAttendanceClassOverview: (classId) =>
    request(`/admin/attendance/overview?classId=${classId}`),

  generateAttendanceWarnings: (classId) =>
    request("/admin/attendance/warnings/generate", {
      method: "POST",
      body: JSON.stringify({ classId }),
    }),

  getAttendanceHistory: (classId, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/attendance/classes/${classId}/history${qs ? `?${qs}` : ""}`);
  },

  getAttendanceAnalytics: (classId, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/attendance/classes/${classId}/analytics${qs ? `?${qs}` : ""}`);
  },

  // Notifications (thông báo)
  getMyNotifications: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/me/notifications${qs ? `?${qs}` : ""}`);
  },

  markNotificationRead: (notificationId) =>
    request(`/admin/me/notifications/${notificationId}/read`, {
      method: "PATCH",
    }).then((res) => { emitNotificationsChanged(); return res; }),

  markAllNotificationsRead: () =>
    request("/admin/me/notifications/read-all", {
      method: "PATCH",
    }).then((res) => { emitNotificationsChanged(); return res; }),

  // Announcements (soạn thông báo) — school-wide / grade-wide / class-wide
  getAnnouncementsMeta: () => request("/admin/announcements/meta"),

  listAnnouncements: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/announcements${qs ? `?${qs}` : ""}`);
  },

  createAnnouncement: (body) =>
    request("/admin/announcements", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateAnnouncement: (announcementId, body) =>
    request(`/admin/announcements/${announcementId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  publishAnnouncement: (announcementId) =>
    request(`/admin/announcements/${announcementId}/publish`, {
      method: "POST",
    }),

  pinAnnouncement: (announcementId, isPinned) =>
    request(`/admin/announcements/${announcementId}/pin`, {
      method: "PATCH",
      body: JSON.stringify({ isPinned }),
    }),

  archiveAnnouncement: (announcementId) =>
    request(`/admin/announcements/${announcementId}/archive`, {
      method: "POST",
    }),

  getAnnouncementReceipts: (announcementId) =>
    request(`/admin/announcements/${announcementId}/receipts`),

  // Messages (tin nhắn) — admin ↔ staff/teacher, same shape as parentApi's block
  getMessageContacts: () => request("/admin/communication/contacts"),

  searchMessageHistory: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/communication/search${qs ? `?${qs}` : ""}`);
  },

  listConversations: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/communication/conversations${qs ? `?${qs}` : ""}`);
  },

  startConversation: (userId) =>
    request("/admin/communication/conversations", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  uploadMessageFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadRequest("/admin/communication/upload", formData);
  },

  getThread: (conversationId, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/communication/conversations/${conversationId}${qs ? `?${qs}` : ""}`);
  },

  sendMessage: (conversationId, body) =>
    request(`/admin/communication/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteMessage: (messageId) =>
    request(`/admin/communication/messages/${messageId}`, {
      method: "DELETE",
    }),

  archiveConversation: (conversationId, archived) =>
    request(`/admin/communication/conversations/${conversationId}/archive`, {
      method: "PATCH",
      body: JSON.stringify({ archived }),
    }),

  // Events (sự kiện) — school-wide, same shape as eventApi
  getEventsMeta: () => request("/admin/events/meta"),

  getEventClassContacts: (classId) => request(`/admin/events/classes/${classId}/contacts`),

  getEventsDashboard: () => request("/admin/events/dashboard"),

  getEventsAnalytics: () => request("/admin/events/analytics"),

  listEvents: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/admin/events${qs ? `?${qs}` : ""}`);
  },

  createEvent: (body) =>
    request("/admin/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getEventDetail: (id) => request(`/admin/events/${id}`),

  updateEvent: (id, body) =>
    request(`/admin/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  changeEventStatus: (id, status) =>
    request(`/admin/events/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  duplicateEvent: (id) =>
    request(`/admin/events/${id}/duplicate`, {
      method: "POST",
    }),

  sendEventReminder: (id) =>
    request(`/admin/events/${id}/reminder`, {
      method: "POST",
    }),

  saveEventOutcome: (id, body) =>
    request(`/admin/events/${id}/outcome`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  addEventParticipants: (id, participants) =>
    request(`/admin/events/${id}/participants`, {
      method: "POST",
      body: JSON.stringify({ participants }),
    }),

  removeEventParticipant: (id, registrationId) =>
    request(`/admin/events/${id}/participants/${registrationId}`, {
      method: "DELETE",
    }),

  markEventAttendance: (id, registrationId, status) =>
    request(`/admin/events/${id}/participants/${registrationId}/attendance`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  uploadEventDocument: (id, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadRequest(`/admin/events/${id}/documents`, formData);
  },

  deleteEventDocument: (id, attachmentId) =>
    request(`/admin/events/${id}/documents/${attachmentId}`, {
      method: "DELETE",
    }),
};

export const studentApi = {
  getMyProfile: () =>
    request("/students/me"),

  getMyDashboard: () =>
    request("/students/me/dashboard"),

  // Nhận xét theo tiết + khảo sát GV (ẩn danh)
  getMyLessonFeedback: () =>
    request("/students/me/feedback"),

  getMySurveys: () =>
    request("/students/me/surveys"),

  submitMySurvey: (surveyId, body) =>
    request(`/students/me/surveys/${surveyId}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getMyTimetable: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/timetable${qs ? `?${qs}` : ""}`);
  },

  getMyHomeworks: () =>
    request("/students/me/homeworks"),

  getMyHomeworkDetail: (homeworkId) =>
    request(`/students/me/homeworks/${homeworkId}`),

  submitHomework: (homeworkId, { content, file }) => {
    const formData = new FormData();
    formData.append("content", content || "");

    if (file) {
      formData.append("file", file);
    }

    return uploadRequest(
      `/students/me/homeworks/${homeworkId}/submission`,
      formData,
    );
  },

  updateMyProfile: (body) =>
    request("/students/me", {
      method: "PATCH",
      body: JSON.stringify({
        phone: body.phone || "",
        dateOfBirth: body.dateOfBirth || "",
        gender: body.gender || "OTHER",
        address: body.address || "",
      }),
    }),

  searchMessageHistory: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/communication/search${qs ? `?${qs}` : ""}`);
  },

  getMyGrades: () =>
    request("/students/me/grades"),

  getMyAttendanceHistory: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/attendance/history${qs ? `?${qs}` : ""}`);
  },

  getMyAttendanceAnalytics: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/attendance/analytics${qs ? `?${qs}` : ""}`);
  },

  getMyLeaveRequests: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/leave-requests${qs ? `?${qs}` : ""}`);
  },

  getMyBehaviour: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/behaviour${qs ? `?${qs}` : ""}`);
  },

  getGoalTypes: () =>
    request("/students/me/goals/types"),

  getMyGoals: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/goals${qs ? `?${qs}` : ""}`);
  },

  createMyGoal: (body) =>
    request("/students/me/goals", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateMyGoal: (goalId, body) =>
    request(`/students/me/goals/${goalId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  getMyEvents: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/events${qs ? `?${qs}` : ""}`);
  },

  getMyEventDetail: (eventId) =>
    request(`/students/me/events/${eventId}`),

  registerMyEvent: (eventId) =>
    request(`/students/me/events/${eventId}/register`, {
      method: "POST",
    }),

  getMyNotifications: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/notifications${qs ? `?${qs}` : ""}`);
  },

  markNotificationRead: (notificationId) =>
    request(`/students/me/notifications/${notificationId}/read`, {
      method: "PATCH",
    }).then((res) => { emitNotificationsChanged(); return res; }),

  markAllNotificationsRead: () =>
    request("/students/me/notifications/read-all", {
      method: "PATCH",
    }).then((res) => { emitNotificationsChanged(); return res; }),

  getMessageContacts: () =>
    request("/students/me/communication/contacts"),

  listConversations: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/communication/conversations${qs ? `?${qs}` : ""}`);
  },

  startConversation: (teacherUserId) =>
    request("/students/me/communication/conversations", {
      method: "POST",
      body: JSON.stringify({ teacherUserId }),
    }),

  uploadMessageFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);

    return uploadRequest("/students/me/communication/upload", formData);
  },

  getThread: (conversationId, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/communication/conversations/${conversationId}${qs ? `?${qs}` : ""}`);
  },

  sendMessage: (conversationId, body) =>
    request(`/students/me/communication/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteMessage: (messageId) =>
    request(`/students/me/communication/messages/${messageId}`, {
      method: "DELETE",
    }),

  archiveConversation: (conversationId, archived) =>
    request(`/students/me/communication/conversations/${conversationId}/archive`, {
      method: "PATCH",
      body: JSON.stringify({ archived }),
    }),
};

export const teacherApi = {
  getMyProfile: () =>
    request("/teachers/me"),

  getDashboardSummary: () =>
    request("/teachers/me/dashboard"),

  // Trung tâm thông báo GVCN (thông báo lớp + cảnh báo HS + việc cần xử lý)
  getNotifications: () =>
    request("/teachers/notifications"),

  // Đánh dấu 1 mục trong feed là đã đọc (lưu DB notification_read_state)
  markNotificationRead: (key) =>
    request("/teachers/notifications/read", {
      method: "POST",
      body: JSON.stringify({ key }),
    }),

  // Điểm danh theo tiết (per-period)
  getMyPeriods: (date) =>
    request(`/teachers/attendance/periods?date=${date}`),

  getPeriodSheet: (timetableId, date) =>
    request(`/teachers/attendance/periods/${timetableId}?date=${date}`),

  submitPeriodAttendance: (timetableId, body) =>
    request(`/teachers/attendance/periods/${timetableId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // GVBM: nhận xét theo tiết
  submitPeriodFeedback: (timetableId, body) =>
    request(`/teachers/attendance/periods/${timetableId}/feedback`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // GVCN: tổng hợp điểm danh lớp chủ nhiệm + ngưỡng nghỉ
  getClassAttendanceOverview: (classId) =>
    request(`/teachers/attendance/overview?classId=${classId}`),

  generateAbsenceWarnings: (classId) =>
    request(`/teachers/attendance/warnings/generate`, {
      method: "POST",
      body: JSON.stringify({ classId }),
    }),

  updateAttendanceRecord: (attendanceId, body) =>
    request(`/teachers/attendance/${attendanceId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  getAttendanceHistory: (classId, params = {}) => {
    const qs = new URLSearchParams(params).toString();

    return request(
      `/teachers/classes/${classId}/attendance/history${qs ? `?${qs}` : ""}`,
    );
  },

  getAttendanceAnalytics: (classId, params = {}) => {
    const qs = new URLSearchParams(params).toString();

    return request(
      `/teachers/classes/${classId}/attendance/analytics${qs ? `?${qs}` : ""}`,
    );
  },

  getLeaveRequests: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/leave-requests${qs ? `?${qs}` : ""}`,
    );
  },

  getLeaveRequestDetail: (leaveRequestId) =>
    request(`/teachers/leave-requests/${leaveRequestId}`),

  decideLeaveRequest: (leaveRequestId, body) =>
    request(`/teachers/leave-requests/${leaveRequestId}/decision`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

async function uploadRequest(
  path,
  formData,
  options = {},
) {
  const token = getAuthToken();

  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE}${path}`,
      {
        method: options.method || "POST",
        headers,
        body: formData,
      },
    );
  } catch {
    throw new Error(
      "Không kết nối được backend. " +
      "Hãy chạy backend bằng npm run dev.",
    );
  }

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
      `Tải tệp thất bại (${response.status})`,
    );
  }

  return data;
}

export const homeworkApi = {
  getAssignments: () =>
    request("/teachers/homework/assignments"),

  list: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/homework${qs ? `?${qs}` : ""}`,
    );
  },

  detail: (homeworkId) =>
    request(`/teachers/homework/${homeworkId}`),

  create: (body) =>
    request("/teachers/homework", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (homeworkId, body) =>
    request(`/teachers/homework/${homeworkId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  changeStatus: (homeworkId, status) =>
    request(`/teachers/homework/${homeworkId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    }),

  getSubmissions: (homeworkId) =>
    request(`/teachers/homework/${homeworkId}/submissions`),

  grade: (submissionId, body) =>
    request(`/teachers/homework/submissions/${submissionId}/grade`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  getGradeLog: (submissionId) =>
    request(`/teachers/homework/submissions/${submissionId}/grade-log`),

  getAnalytics: (homeworkId) =>
    request(`/teachers/homework/${homeworkId}/analytics`),

  uploadAttachment: (file) => {
    const formData = new FormData();
    formData.append("file", file);

    return uploadRequest(
      "/teachers/homework/attachments",
      formData,
    );
  },

  deleteAttachment: (homeworkId, attachmentId) =>
    request(`/teachers/homework/${homeworkId}/attachments/${attachmentId}`, {
      method: "DELETE",
    }),
};

export const academicApi = {
  getMeta: () =>
    request("/teachers/academic/meta"),

  getScoreSheet: (params) => {
    const qs = new URLSearchParams(params).toString();

    return request(
      `/teachers/academic/scoresheet?${qs}`,
    );
  },

  getGradebook: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/teachers/academic/gradebook?${qs}`);
  },

  submitScores: (body) =>
    request("/teachers/academic/scores", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateScore: (resultId, body) =>
    request(`/teachers/academic/scores/${resultId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteScore: (resultId, reason) =>
    request(`/teachers/academic/scores/${resultId}`, {
      method: "DELETE",
      body: JSON.stringify({
        reason,
      }),
    }),

  getScoreLog: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/academic/scores/log${qs ? `?${qs}` : ""}`,
    );
  },

  getStudentAcademic: (studentId, semesterId) => {
    const qs = semesterId
      ? `?semesterId=${semesterId}`
      : "";

    return request(
      `/teachers/academic/students/${studentId}${qs}`,
    );
  },

  getAnalytics: (classId, semesterId) =>
    request(
      `/teachers/academic/analytics?classId=${classId}&semesterId=${semesterId}`,
    ),

  getTrend: (classId) =>
    request(
      `/teachers/academic/analytics/trend?classId=${classId}`,
    ),

  getWarnings: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/academic/warnings${qs ? `?${qs}` : ""}`,
    );
  },

  generateWarnings: (classId, semesterId) =>
    request("/teachers/academic/warnings/generate", {
      method: "POST",
      body: JSON.stringify({
        classId,
        semesterId,
      }),
    }),

  updateWarning: (warningId, body) =>
    request(`/teachers/academic/warnings/${warningId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const behaviourApi = {
  getMeta: () =>
    request("/teachers/behaviour/meta"),

  listRecords: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/behaviour/records${qs ? `?${qs}` : ""}`,
    );
  },

  createRecord: (body) =>
    request("/teachers/behaviour/records", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateRecord: (behaviorId, body) =>
    request(`/teachers/behaviour/records/${behaviorId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  archiveRecord: (behaviorId, reason) =>
    request(`/teachers/behaviour/records/${behaviorId}/archive`, {
      method: "POST",
      body: JSON.stringify({
        reason,
      }),
    }),

  getRecordLog: (behaviorId) =>
    request(`/teachers/behaviour/records/${behaviorId}/log`),

  getConductPreview: (studentId, semesterId) =>
    request(
      `/teachers/behaviour/conduct?studentId=${studentId}&semesterId=${semesterId}`,
    ),

  evaluateConduct: (body) =>
    request("/teachers/behaviour/conduct", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getStudentBehaviour: (studentId, semesterId) => {
    const qs = semesterId
      ? `?semesterId=${semesterId}`
      : "";

    return request(
      `/teachers/behaviour/students/${studentId}${qs}`,
    );
  },

  getAnalytics: (classId, semesterId) =>
    request(
      `/teachers/behaviour/analytics?classId=${classId}&semesterId=${semesterId}`,
    ),

  getWarnings: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/behaviour/warnings${qs ? `?${qs}` : ""}`,
    );
  },

  generateWarnings: (classId, semesterId) =>
    request("/teachers/behaviour/warnings/generate", {
      method: "POST",
      body: JSON.stringify({
        classId,
        semesterId,
      }),
    }),

  updateWarning: (warningId, body) =>
    request(`/teachers/behaviour/warnings/${warningId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const studentProfileApi = {
  getMeta: () =>
    request("/teachers/students/meta"),

  getClassOverview: (classId, semesterId) => {
    const qs = new URLSearchParams({
      classId,
      ...(semesterId ? { semesterId } : {}),
    }).toString();

    return request(
      `/teachers/students/overview?${qs}`,
    );
  },

  getProfile: (studentId, semesterId) => {
    const qs = semesterId
      ? `?semesterId=${semesterId}`
      : "";

    return request(
      `/teachers/students/${studentId}/profile${qs}`,
    );
  },

  getAttendance: (studentId, semesterId) => {
    const qs = semesterId
      ? `?semesterId=${semesterId}`
      : "";

    return request(
      `/teachers/students/${studentId}/attendance${qs}`,
    );
  },
};

export const goalApi = {
  getTypes: () =>
    request("/teachers/goals/types"),

  listByStudent: (studentId, params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/students/${studentId}/goals${qs ? `?${qs}` : ""}`,
    );
  },

  listByClass: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/goals${qs ? `?${qs}` : ""}`,
    );
  },

  comment: (goalId, comment) =>
    request(`/teachers/goals/${goalId}/comment`, {
      method: "PATCH",
      body: JSON.stringify({ comment }),
    }),
};

async function downloadRequest(path, body, fallbackName) {
  const token = getAuthToken();

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE}${path}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new Error(
      "Không kết nối được backend. " +
      "Hãy chạy backend bằng npm run dev.",
    );
  }

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({}));

    throw new Error(
      data.message ||
      `Xuất báo cáo thất bại (${response.status})`,
    );
  }

  const blob = await response.blob();
  const disposition =
    response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match
    ? match[1]
    : fallbackName;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.URL.revokeObjectURL(url);
}

export const reportApi = {
  getMeta: () =>
    request("/teachers/reports/meta"),

  generate: (reportType, filters) =>
    request("/teachers/reports/generate", {
      method: "POST",
      body: JSON.stringify({
        reportType,
        filters,
      }),
    }),

  exportExcel: (reportType, filters) =>
    downloadRequest(
      "/teachers/reports/export-excel",
      {
        reportType,
        filters,
      },
      "bao_cao.xlsx",
    ),

  logExport: (reportType, filters, format) =>
    request("/teachers/reports/log-export", {
      method: "POST",
      body: JSON.stringify({
        reportType,
        filters,
        format,
      }),
    }),

  getHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();

    return request(
      `/teachers/reports/history${qs ? `?${qs}` : ""}`,
    );
  },

  listTemplates: () =>
    request("/teachers/reports/templates"),

  createTemplate: (body) =>
    request("/teachers/reports/templates", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteTemplate: (templateId) =>
    request(`/teachers/reports/templates/${templateId}`, {
      method: "DELETE",
    }),

  runTemplate: (templateId) =>
    request(`/teachers/reports/templates/${templateId}/run`, {
      method: "POST",
    }),
};

export const communicationApi = {
  getDashboard: () =>
    request("/teachers/communication/dashboard"),

  getContacts: () =>
    request("/teachers/communication/contacts"),

  listConversations: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/communication/conversations${qs ? `?${qs}` : ""}`,
    );
  },

  startConversation: (body) =>
    request("/teachers/communication/conversations", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createGroup: (body) =>
    request("/teachers/communication/groups", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getThread: (conversationId, params = {}) => {
    const qs = new URLSearchParams(params).toString();

    return request(
      `/teachers/communication/conversations/${conversationId}${qs ? `?${qs}` : ""}`,
    );
  },

  sendMessage: (conversationId, body) =>
    request(`/teachers/communication/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteMessage: (messageId) =>
    request(`/teachers/communication/messages/${messageId}`, {
      method: "DELETE",
    }),

  archiveConversation: (conversationId, archived) =>
    request(`/teachers/communication/conversations/${conversationId}/archive`, {
      method: "PATCH",
      body: JSON.stringify({
        archived,
      }),
    }),

  uploadFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);

    return uploadRequest(
      "/teachers/communication/upload",
      formData,
    );
  },
};

export const announcementApi = {
  list: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/announcements${qs ? `?${qs}` : ""}`,
    );
  },

  create: (body) =>
    request("/teachers/announcements", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id, body) =>
    request(`/teachers/announcements/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  publish: (id) =>
    request(`/teachers/announcements/${id}/publish`, {
      method: "POST",
    }),

  pin: (id, isPinned) =>
    request(`/teachers/announcements/${id}/pin`, {
      method: "PATCH",
      body: JSON.stringify({
        isPinned,
      }),
    }),

  archive: (id) =>
    request(`/teachers/announcements/${id}/archive`, {
      method: "POST",
    }),

  getReceipts: (id) =>
    request(`/teachers/announcements/${id}/receipts`),
};

export const meetingApi = {
  getMeta: () =>
    request("/teachers/meetings/meta"),

  getClassParents: (classId) =>
    request(`/teachers/meetings/classes/${classId}/parents`),

  getDashboard: () =>
    request("/teachers/meetings/dashboard"),

  list: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/meetings${qs ? `?${qs}` : ""}`,
    );
  },

  create: (body) =>
    request("/teachers/meetings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getDetail: (id) =>
    request(`/teachers/meetings/${id}`),

  update: (id, body) =>
    request(`/teachers/meetings/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  changeStatus: (id, status) =>
    request(`/teachers/meetings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    }),

  addInvitees: (id, invitees) =>
    request(`/teachers/meetings/${id}/invitations`, {
      method: "POST",
      body: JSON.stringify({
        invitees,
      }),
    }),

  resendInvitation: (id, invitationId, userId) =>
    request(`/teachers/meetings/${id}/invitations/${invitationId}/resend`, {
      method: "POST",
      body: JSON.stringify({
        userId,
      }),
    }),

  saveMinutes: (id, body) =>
    request(`/teachers/meetings/${id}/minutes`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  createAction: (id, body) =>
    request(`/teachers/meetings/${id}/actions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateActionStatus: (id, actionId, status) =>
    request(`/teachers/meetings/${id}/actions/${actionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    }),
};

export const parentMeetingApi = {
  getDashboard: () =>
    request("/parents/me/meetings/dashboard"),

  list: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    );
    const qs = new URLSearchParams(cleaned).toString();
    return request(`/parents/me/meetings${qs ? `?${qs}` : ""}`);
  },

  getDetail: (id) =>
    request(`/parents/me/meetings/${id}`),

  respond: (id, action) =>
    request(`/parents/me/meetings/${id}/invitation`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    }),
};

export const eventApi = {
  getMeta: () =>
    request("/teachers/events/meta"),

  getClassContacts: (classId) =>
    request(`/teachers/events/classes/${classId}/contacts`),

  getDashboard: () =>
    request("/teachers/events/dashboard"),

  getAnalytics: () =>
    request("/teachers/events/analytics"),

  list: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/events${qs ? `?${qs}` : ""}`,
    );
  },

  // KHÔNG có create/duplicate: tạo (và nhân bản) sự kiện là nghiệp vụ của giáo vụ
  // (staff) — route POST /teachers/events đã được gỡ ở backend. Trang giáo vụ
  // dùng adminApi.createEvent / duplicateEvent (đã mở cho ADMIN + STAFF).

  getDetail: (id) =>
    request(`/teachers/events/${id}`),

  // KHÔNG có update / changeStatus: sửa nội dung và đổi trạng thái sự kiện là
  // quyền của giáo vụ (route PUT + PATCH status ở /teachers/events đã gỡ).

  sendReminder: (id) =>
    request(`/teachers/events/${id}/reminder`, {
      method: "POST",
    }),

  saveOutcome: (id, body) =>
    request(`/teachers/events/${id}/outcome`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  addParticipants: (id, participants) =>
    request(`/teachers/events/${id}/participants`, {
      method: "POST",
      body: JSON.stringify({
        participants,
      }),
    }),

  removeParticipant: (id, registrationId) =>
    request(`/teachers/events/${id}/participants/${registrationId}`, {
      method: "DELETE",
    }),

  markAttendance: (id, registrationId, status) =>
    request(`/teachers/events/${id}/participants/${registrationId}/attendance`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    }),

  uploadDocument: (id, file) => {
    const formData = new FormData();
    formData.append("file", file);

    return uploadRequest(
      `/teachers/events/${id}/documents`,
      formData,
    );
  },

  deleteDocument: (id, attachmentId) =>
    request(`/teachers/events/${id}/documents/${attachmentId}`, {
      method: "DELETE",
    }),
};

export const timetableApi = {
  getMyTimetable: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/teachers/timetable${qs ? `?${qs}` : ""}`);
  },

  getSubstitutionMeta: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/teachers/timetable/substitutions/meta${qs ? `?${qs}` : ""}`);
  },

  listSubstitutions: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/timetable/substitutions${qs ? `?${qs}` : ""}`,
    );
  },

  createSubstitution: (body) =>
    request("/teachers/timetable/substitutions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  cancelSubstitution: (id) =>
    request(`/teachers/timetable/substitutions/${id}/cancel`, {
      method: "POST",
    }),
};

export const supportCaseApi = {
  list: (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => value !== "" && value != null,
      ),
    );

    const qs = new URLSearchParams(cleaned).toString();

    return request(
      `/teachers/support-cases${qs ? `?${qs}` : ""}`,
    );
  },

  create: (body) =>
    request("/teachers/support-cases", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getUpdates: (caseId) =>
    request(`/teachers/support-cases/${caseId}/updates`),

  addUpdate: (caseId, body) =>
    request(`/teachers/support-cases/${caseId}/updates`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const parentApi = {
  getMyProfile: () =>
    request("/parents/me"),

  getMyStudents: () =>
    request("/parents/me/students"),

  getStudentProfile: (studentId) =>
    request(`/parents/me/students/${studentId}`),

  getStudentLessonFeedback: (studentId) =>
    request(`/parents/me/students/${studentId}/feedback`),

  getStudentTimetable: (studentId) =>
    request(`/parents/me/students/${studentId}/timetable`),

  getStudentGrades: (studentId) =>
    request(`/parents/me/students/${studentId}/grades`),

  getStudentAttendanceHistory: (studentId, params = {}) => {
    const qs = new URLSearchParams(params).toString();

    return request(
      `/parents/me/students/${studentId}/attendance/history${qs ? `?${qs}` : ""}`,
    );
  },

  getStudentAttendanceAnalytics: (studentId, params = {}) => {
    const qs = new URLSearchParams(params).toString();

    return request(
      `/parents/me/students/${studentId}/attendance/analytics${qs ? `?${qs}` : ""}`,
    );
  },

  getStudentLeaveRequests: (studentId, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(
      `/parents/me/students/${studentId}/leave-requests${qs ? `?${qs}` : ""}`,
    );
  },

  getLeaveRequestDetail: (studentId, leaveRequestId) =>
    request(
      `/parents/me/students/${studentId}/leave-requests/${leaveRequestId}`,
    ),

  createLeaveRequest: (studentId, formData) =>
    request(`/parents/me/students/${studentId}/leave-requests`, {
      method: "POST",
      body: formData,
    }),

  cancelLeaveRequest: (studentId, leaveRequestId) =>
    request(`/parents/me/students/${studentId}/leave-requests/${leaveRequestId}/cancel`, {
      method: "PATCH",
    }),

  getStudentBehaviourSemesters: (studentId) =>
    request(`/parents/me/students/${studentId}/behaviour/semesters`),

  getStudentBehaviourRecords: (studentId, params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    );
    const qs = new URLSearchParams(cleaned).toString();
    return request(`/parents/me/students/${studentId}/behaviour/records${qs ? `?${qs}` : ""}`);
  },

  getStudentBehaviourConduct: (studentId, semesterId) =>
    request(`/parents/me/students/${studentId}/behaviour/conduct?semesterId=${semesterId}`),

  getStudentHomework: (studentId, params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    );
    const qs = new URLSearchParams(cleaned).toString();
    return request(`/parents/me/students/${studentId}/homework${qs ? `?${qs}` : ""}`);
  },

  getStudentHomeworkDetail: (studentId, homeworkId) =>
    request(`/parents/me/students/${studentId}/homework/${homeworkId}`),

  getStudentGoals: (studentId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/parents/me/students/${studentId}/goals${qs ? `?${qs}` : ""}`);
  },

  getStudentEvents: (studentId, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/parents/me/students/${studentId}/events${qs ? `?${qs}` : ""}`);
  },

  registerStudentEvent: (studentId, eventId) =>
    request(`/parents/me/students/${studentId}/events/${eventId}/register`, {
      method: "POST",
    }),

  getMyNotifications: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/parents/me/notifications${qs ? `?${qs}` : ""}`);
  },

  markNotificationRead: (notificationId) =>
    request(`/parents/me/notifications/${notificationId}/read`, {
      method: "PATCH",
    }).then((res) => { emitNotificationsChanged(); return res; }),

  markAllNotificationsRead: () =>
    request("/parents/me/notifications/read-all", {
      method: "PATCH",
    }).then((res) => { emitNotificationsChanged(); return res; }),

  getStudentNotificationFeed: (studentId) =>
    request(`/parents/me/students/${studentId}/notifications/feed`),

  getMessageContacts: () =>
    request("/parents/me/communication/contacts"),

  searchMessageHistory: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/parents/me/communication/search${qs ? `?${qs}` : ""}`);
  },

  listConversations: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/parents/me/communication/conversations${qs ? `?${qs}` : ""}`);
  },

  startConversation: (teacherUserId) =>
    request("/parents/me/communication/conversations", {
      method: "POST",
      body: JSON.stringify({ teacherUserId }),
    }),

  uploadMessageFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);

    return uploadRequest("/parents/me/communication/upload", formData);
  },

  getThread: (conversationId, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/parents/me/communication/conversations/${conversationId}${qs ? `?${qs}` : ""}`);
  },

  sendMessage: (conversationId, body) =>
    request(`/parents/me/communication/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteMessage: (messageId) =>
    request(`/parents/me/communication/messages/${messageId}`, {
      method: "DELETE",
    }),

  archiveConversation: (conversationId, archived) =>
    request(`/parents/me/communication/conversations/${conversationId}/archive`, {
      method: "PATCH",
      body: JSON.stringify({ archived }),
    }),

  getStudentFees: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/parents/me/fees${qs ? `?${qs}` : ""}`);
  },

  getFeeDetail: (feeAssignmentId) =>
    request(`/parents/me/fees/${feeAssignmentId}`),

  createVietQrPayment: (feeAssignmentId) =>
    request(`/parents/me/fees/${feeAssignmentId}/vietqr`, {
      method: "POST",
    }),

  createZaloPayOrder: (feeAssignmentId) =>
    request(`/parents/me/fees/${feeAssignmentId}/zalopay`, {
      method: "POST",
    }),

  getZaloPayOrderStatus: (feeAssignmentId, appTransId) =>
    request(`/parents/me/fees/${feeAssignmentId}/zalopay/${appTransId}/status`),
};

export const staffApi = {
  getOverview: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value),
    ).toString();
    return request(`/staff/overview${query ? `?${query}` : ""}`);
  },

  getLookups: () => request("/staff/lookups"),

  getMessagesDashboard: () => request("/staff/communication/dashboard"),

  getMessageContacts: () => request("/staff/communication/contacts"),

  searchMessageHistory: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== "" && value != null),
    ).toString();
    return request(`/staff/communication/search${qs ? `?${qs}` : ""}`);
  },

  listConversations: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== "" && value != null),
    ).toString();
    return request(`/staff/communication/conversations${qs ? `?${qs}` : ""}`);
  },

  startConversation: (userId) =>
    request("/staff/communication/conversations", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  uploadMessageFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadRequest("/staff/communication/upload", formData);
  },

  getThread: (conversationId, params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== "" && value != null),
    ).toString();
    return request(`/staff/communication/conversations/${conversationId}${qs ? `?${qs}` : ""}`);
  },

  sendMessage: (conversationId, body) =>
    request(`/staff/communication/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteMessage: (messageId) =>
    request(`/staff/communication/messages/${messageId}`, {
      method: "DELETE",
    }),

  archiveConversation: (conversationId, archived) =>
    request(`/staff/communication/conversations/${conversationId}/archive`, {
      method: "PATCH",
      body: JSON.stringify({ archived }),
    }),
  // Thông báo (bảng notification chung — is_read thật, giống student/parent/admin)
  getMyNotifications: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    return request(`/staff/me/notifications${qs ? `?${qs}` : ""}`);
  },

  markNotificationRead: (notificationId) =>
    request(`/staff/me/notifications/${notificationId}/read`, {
      method: "PATCH",
    }).then((res) => { emitNotificationsChanged(); return res; }),

  markAllNotificationsRead: () =>
    request("/staff/me/notifications/read-all", {
      method: "PATCH",
    }).then((res) => { emitNotificationsChanged(); return res; }),

  // Báo cáo (báo cáo) — xem + xuất, không lưu mẫu
  getReportsMeta: () => request("/staff/reports/meta"),

  generateReport: (reportType, filters) =>
    request("/staff/reports/generate", {
      method: "POST",
      body: JSON.stringify({ reportType, filters }),
    }),

  exportReportExcel: (reportType, filters) =>
    downloadRequest("/staff/reports/export-excel", { reportType, filters }, "bao_cao.xlsx"),

  logReportExport: (reportType, filters, format) =>
    request("/staff/reports/log-export", {
      method: "POST",
      body: JSON.stringify({ reportType, filters, format }),
    }),

  getReportHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/staff/reports/history${qs ? `?${qs}` : ""}`);
  },

  // Khảo sát đánh giá giáo viên (ẩn danh)
  listTeacherSurveys: () => request("/staff/surveys"),
  createTeacherSurvey: (body) =>
    request("/staff/surveys", { method: "POST", body: JSON.stringify(body) }),
  closeTeacherSurvey: (id) =>
    request(`/staff/surveys/${id}/close`, { method: "POST" }),
  getTeacherSurveyAggregate: (id) =>
    request(`/staff/surveys/${id}/aggregate`),

  getStudents: (params = {}) => {
    const normalized =
      typeof params === "string" ? { search: params } : params;
    const query = new URLSearchParams(
      Object.entries(normalized).filter(([, value]) => value),
    ).toString();
    return request(`/staff/students${query ? `?${query}` : ""}`);
  },

  getStudent: (id) => request(`/staff/students/${id}`),

  createStudent: (payload) =>
    request("/staff/students", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateStudent: (id, payload) =>
    request(`/staff/students/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  uploadStudentAvatar: (id, file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return uploadRequest(`/staff/students/${id}/avatar`, formData);
  },

  getParents: (params = {}) => {
    const normalized =
      typeof params === "string" ? { search: params } : params;
    const query = new URLSearchParams(
      Object.entries(normalized).filter(([, value]) => value),
    ).toString();
    return request(`/staff/parents${query ? `?${query}` : ""}`);
  },

  getParent: (id) => request(`/staff/parents/${id}`),

  createParent: (payload) =>
    request("/staff/parents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateParent: (id, payload) =>
    request(`/staff/parents/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getTeachers: (params = {}) => {
    const normalized =
      typeof params === "string" ? { search: params } : params;
    const query = new URLSearchParams(
      Object.entries(normalized).filter(([, value]) => value),
    ).toString();
    return request(`/staff/teachers${query ? `?${query}` : ""}`);
  },

  getTeacher: (id) => request(`/staff/teachers/${id}`),

  createTeacher: (payload) =>
    request("/staff/teachers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTeacher: (id, payload) =>
    request(`/staff/teachers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getSchoolYears: () => request("/staff/school-years"),

  createSchoolYear: (payload) =>
    request("/staff/school-years", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSchoolYear: (id, payload) =>
    request(`/staff/school-years/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  initializeSchoolYear: (id) =>
    request(`/staff/school-years/${id}/initialize`, { method: "POST" }),

  getClasses: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value),
    ).toString();
    return request(`/staff/classes${query ? `?${query}` : ""}`);
  },

  getClass: (id) => request(`/staff/classes/${id}`),

  createClass: (payload) =>
    request("/staff/classes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateClass: (id, payload) =>
    request(`/staff/classes/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteClass: (id) =>
    request(`/staff/classes/${id}`, {
      method: "DELETE",
    }),

  enrollStudent: (classId, studentId) =>
    request(`/staff/classes/${classId}/students`, {
      method: "POST",
      body: JSON.stringify({ studentId }),
    }),

  removeStudentFromClass: (classId, studentId) =>
    request(`/staff/classes/${classId}/students/${studentId}`, {
      method: "DELETE",
    }),

  assignTeacher: (classId, payload) =>
    request(`/staff/classes/${classId}/teachers`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  removeTeacherFromClass: (classId, teacherClassId) =>
    request(`/staff/classes/${classId}/teachers/${teacherClassId}`, {
      method: "DELETE",
    }),

  getClassTimetable: (classId, params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value),
    ).toString();
    return request(
      `/staff/classes/${classId}/timetable${query ? `?${query}` : ""}`,
    );
  },

  createClassTimetableLesson: (classId, payload) =>
    request(`/staff/classes/${classId}/timetable`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateClassTimetableLesson: (classId, timetableId, payload) =>
    request(`/staff/classes/${classId}/timetable/${timetableId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteClassTimetableLesson: (classId, timetableId) =>
    request(`/staff/classes/${classId}/timetable/${timetableId}`, {
      method: "DELETE",
    }),

  createTimetableLessons: (payload) =>
    request("/staff/timetable", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getTimetableSubstitutions: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== "" && value != null),
    ).toString();
    return request(`/staff/timetable/substitutions${query ? `?${query}` : ""}`);
  },

  getTimetableSubstitution: (id) =>
    request(`/staff/timetable/substitutions/${id}`),

  reviewTimetableSubstitution: (id, payload) =>
    request(`/staff/timetable/substitutions/${id}/decision`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getFeePlans: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value),
    ).toString();
    return request(`/staff/fees${query ? `?${query}` : ""}`);
  },

  getFeePlan: (id) => request(`/staff/fees/${id}`),

  createFeePlan: (payload) =>
    request("/staff/fees", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateFeePlanStatus: (id, status) =>
    request(`/staff/fees/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  recordFeePayment: (feePlanId, assignmentId, payload) =>
    request(`/staff/fees/${feePlanId}/assignments/${assignmentId}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getCurriculum: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value),
    ).toString();
    return request(`/staff/curriculum${query ? `?${query}` : ""}`);
  },

  getCurriculumItem: (id) => request(`/staff/curriculum/${id}`),

  createCurriculumItem: (payload) =>
    request("/staff/curriculum", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCurriculumItem: (id, payload) =>
    request(`/staff/curriculum/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteCurriculumItem: (id) =>
    request(`/staff/curriculum/${id}`, { method: "DELETE" }),

  updateStudySession: (sessionId, payload) =>
    request(`/staff/curriculum/sessions/${sessionId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

};

// ── Giáo viên Quản nhiệm (GVQN / DORM_SUPERVISOR) ────────────────────────────
export const supervisorApi = {
  getDashboard: () => request("/supervisor/dashboard"),

  getNotifications: () => request("/supervisor/notifications"),

  // Đánh dấu 1 mục trong feed là đã đọc (lưu DB notification_read_state)
  markNotificationRead: (key) =>
    request("/supervisor/notifications/read", {
      method: "POST",
      body: JSON.stringify({ key }),
    }),

  getAreas: () => request("/supervisor/areas"),

  getAttendance: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== ""),
    ).toString();
    return request(`/supervisor/attendance${qs ? `?${qs}` : ""}`);
  },

  submitBulkAttendance: (body) =>
    request("/supervisor/attendance/bulk", { method: "POST", body: JSON.stringify(body) }),

  getLogbook: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== ""),
    ).toString();
    return request(`/supervisor/logbook${qs ? `?${qs}` : ""}`);
  },

  createLogEntry: (body) =>
    request("/supervisor/logbook", { method: "POST", body: JSON.stringify(body) }),

  getLeaveRequests: () => request("/supervisor/leave-requests"),

  decideLeaveRequest: (id, action, comment) =>
    request(`/supervisor/leave-requests/${id}/decide`, { method: "POST", body: JSON.stringify({ action, comment }) }),

  getWeekend: (date) => request(`/supervisor/weekend${date ? `?date=${date}` : ""}`),

  setWeekendStatus: (id, status) =>
    request(`/supervisor/weekend/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getSupport: (status) => request(`/supervisor/support${status ? `?status=${status}` : ""}`),

  createSupport: (body) =>
    request("/supervisor/support", { method: "POST", body: JSON.stringify(body) }),

  getContacts: () => request("/supervisor/contacts"),

  createTask: (body) =>
    request("/supervisor/tasks", { method: "POST", body: JSON.stringify(body) }),

  updateTaskStatus: (taskId, status) =>
    request(`/supervisor/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
