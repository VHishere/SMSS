import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authApi } from "../api/client";

const AuthContext = createContext(null);

const TOKEN_KEY = "kidcare_token";
const USER_KEY = "kidcare_user";

function getSavedUser() {
  try {
    const saved = localStorage.getItem(USER_KEY);

    return saved ? JSON.parse(saved) : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser);

  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem(TOKEN_KEY)),
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setUser(null);
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem(TOKEN_KEY, token);

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(userData),
    );

    setUser(userData);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      return undefined;
    }

    let isMounted = true;

    authApi
      .getMe()
      .then((res) => {
        if (!isMounted) {
          return;
        }

        setUser(res.data);

        localStorage.setItem(
          USER_KEY,
          JSON.stringify(res.data),
        );
      })
      .catch(() => {
        if (isMounted) {
          logout();
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAuthenticated: Boolean(user),
    }),
    [user, loading, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth phải được dùng trong AuthProvider",
    );
  }

  return context;
}