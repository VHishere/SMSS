const API_BASE =
  import.meta.env.VITE_API_URL ||
  "/api";

async function request(
  path,
  options = {},
) {
  const token =
    localStorage.getItem(
      "kidcare_token",
    );

  const headers = {
    "Content-Type": "application/json",
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

  getMyTimetable: () =>
    request("/parents/student/timetable"),
};