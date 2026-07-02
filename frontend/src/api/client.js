const API_BASE =
  import.meta.env.VITE_API_URL ||
  "/api";

function getAuthToken() {
  return (
    sessionStorage.getItem("kidcare_token") ||
    localStorage.getItem("kidcare_token")
  );
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
    throw new Error(
      data.message ||
      `Yêu cầu thất bại (${response.status})`,
    );
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

export const studentApi = {
  getMyProfile: () =>
    request("/students/me"),

  getMyDashboard: () =>
    request("/students/me/dashboard"),

  getMyTimetable: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/timetable${qs ? `?${qs}` : ""}`);
  },

  getMyHomeworks: () =>
    request("/students/me/homeworks"),

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

  updateMyGoalProgress: (goalId, body) =>
    request(`/students/me/goals/${goalId}/progress`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  getMyGoalLog: (goalId) =>
    request(`/students/me/goals/${goalId}/log`),

  getMyEvents: (params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();

    return request(`/students/me/events${qs ? `?${qs}` : ""}`);
  },

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
    }),

  markAllNotificationsRead: () =>
    request("/students/me/notifications/read-all", {
      method: "PATCH",
    }),

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

  getAttendanceSheet: (classId, date) =>
    request(`/teachers/classes/${classId}/attendance?date=${date}`),

  submitAttendance: (classId, body) =>
    request(`/teachers/classes/${classId}/attendance`, {
      method: "POST",
      body: JSON.stringify(body),
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

async function uploadRequest(path, formData) {
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
        method: "POST",
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

  create: (studentId, body) =>
    request(`/teachers/students/${studentId}/goals`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (goalId, body) =>
    request(`/teachers/goals/${goalId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  updateProgress: (goalId, body) =>
    request(`/teachers/goals/${goalId}/progress`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  evaluate: (goalId, body) =>
    request(`/teachers/goals/${goalId}/evaluate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  archive: (goalId, note) =>
    request(`/teachers/goals/${goalId}/archive`, {
      method: "POST",
      body: JSON.stringify({
        note,
      }),
    }),

  getLog: (goalId) =>
    request(`/teachers/goals/${goalId}/log`),
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

  create: (body) =>
    request("/teachers/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getDetail: (id) =>
    request(`/teachers/events/${id}`),

  update: (id, body) =>
    request(`/teachers/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  changeStatus: (id, status) =>
    request(`/teachers/events/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    }),

  duplicate: (id) =>
    request(`/teachers/events/${id}/duplicate`, {
      method: "POST",
    }),

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
  getMyTimetable: () =>
    request("/teachers/timetable"),

  getSubstitutionMeta: () =>
    request("/teachers/timetable/substitutions/meta"),

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
    const qs = new URLSearchParams(params).toString();

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
};

export const staffApi = {
  getOverview: () => request("/staff/overview"),

  getLookups: () => request("/staff/lookups"),

  getStudents: (search = "") => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return request(`/staff/students${query}`);
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

  getParents: (search = "") => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return request(`/staff/parents${query}`);
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

  getSchoolYears: () => request("/staff/school-years"),

  createSchoolYear: (payload) =>
    request("/staff/school-years", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  activateSchoolYear: (id) =>
    request(`/staff/school-years/${id}/activate`, { method: "PUT" }),

  updateSchoolYear: (id, payload) =>
    request(`/staff/school-years/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

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

  getPromotionCandidates: (fromSchoolYearId, fromGradeId) =>
    request(
      `/staff/promotion/candidates?fromSchoolYearId=${fromSchoolYearId}&fromGradeId=${fromGradeId}`,
    ),

  getTargetClasses: (toSchoolYearId, toGradeId) =>
    request(
      `/staff/promotion/target-classes?toSchoolYearId=${toSchoolYearId}&toGradeId=${toGradeId}`,
    ),

  promoteStudents: (payload) =>
    request("/staff/promotion", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};