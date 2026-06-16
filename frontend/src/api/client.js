const API_BASE =
  import.meta.env.VITE_API_URL ||
  "/api";

async function request(
  path,
  options = {},
) {
  const token =
    sessionStorage.getItem(
      "kidcare_token",
    );
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
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

  getMe: () =>
    request("/auth/me"),
};

export const studentApi = {
  getMyProfile: () =>
    request("/students/me"),

  getMyTimetable: () =>
    request("/students/me/timetable"),
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

  getStudentAttendanceHistory: (studentId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(
      `/parents/me/students/${studentId}/attendance/history${qs ? `?${qs}` : ""}`,
    );
  },

  getStudentLeaveRequests: (studentId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(
      `/parents/me/students/${studentId}/leave-requests${qs ? `?${qs}` : ""}`,
    );
  },

  getLeaveRequestDetail: (studentId, leaveRequestId) =>
    request(`/parents/me/students/${studentId}/leave-requests/${leaveRequestId}`),

  createLeaveRequest: (studentId, formData) =>
    request(`/parents/me/students/${studentId}/leave-requests`, {
      method: "POST",
      body: formData,
    }),

  cancelLeaveRequest: (studentId, leaveRequestId) =>
    request(`/parents/me/students/${studentId}/leave-requests/${leaveRequestId}/cancel`, {
      method: "PATCH",
    }),
};