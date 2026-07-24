import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import {
  GoogleLogin,
} from "@react-oauth/google";

import {
  authApi,
} from "../api/client";

import {
  useAuth,
} from "../context/useAuth";

import {
  saveLastPortal,
} from "../utils/auth";

export function LoginPage({
  portal,
}) {
  const isSchool = portal === "school";
  const navigate = useNavigate();

  const {
    login,
    user,
    loading,
    isAuthenticated,
  } = useAuth();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [pendingMessage, setPendingMessage] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [googleSubmitting, setGoogleSubmitting] =
    useState(false);

  useEffect(() => {
    saveLastPortal(portal);
  }, [portal]);

  if (loading) {
    return (
      <div className="page-loading">
        Đang tải...
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={user.dashboardPath || "/"}
        replace
      />
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setPendingMessage("");
    setSubmitting(true);

    try {
      const response = isSchool
        ? await authApi.loginSchool(email, password)
        : await authApi.loginParent(email, password);

      const {
        token,
        user: userData,
      } = response.data;

      login(token, userData);
      navigate(userData.dashboardPath || "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (
    credentialResponse,
  ) => {
    setError("");
    setPendingMessage("");
    setGoogleSubmitting(true);

    try {
      const credential =
        credentialResponse.credential;

      if (!credential) {
        throw new Error(
          "Không lấy được Google credential",
        );
      }

      const response = isSchool
        ? await authApi.loginGoogleSchool(credential)
        : await authApi.loginGoogleParent(credential);

      if (response.data.pending) {
        setPendingMessage(
          response.data.message ||
            "Tài khoản đang chờ quản trị viên cấp quyền truy cập.",
        );
        return;
      }

      const {
        token,
        user: userData,
      } = response.data;

      login(token, userData);
      navigate(userData.dashboardPath || "/");
    } catch (err) {
      setError(
        err.message ||
          "Đăng nhập Google thất bại",
      );
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className={`login-page ${portal}`}>
      <div className="login-card">
        <Link
          to="/"
          className="back-link"
        >
          ← Quay lại
        </Link>

        <div className="login-brand">
          <span className="brand-mark">
            FPT
          </span>

          <p className="eyebrow">
            {isSchool
              ? "Cổng Trường"
              : "Cổng Phụ huynh"}
          </p>
        </div>

        <h1>Đăng nhập</h1>

        <p className="lead">
          {isSchool
            ? "Sử dụng email trường (@edu.fpt.vn hoặc @fptschool.edu.vn)"
            : "Sử dụng email cá nhân được nhà trường cấp"}
        </p>

        <form
          onSubmit={handleSubmit}
          className="login-form"
        >
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder={
                isSchool
                  ? "ten@fptschool.edu.vn"
                  : "ten@example.com"
              }
              required
              autoComplete="email"
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Nhập mật khẩu"
              required
              autoComplete="current-password"
            />
          </label>

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}

          {pendingMessage && (
            <p
              className="form-info"
              style={{
                color: "#1D4ED8",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {pendingMessage}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
          >
            {submitting
              ? "Đang đăng nhập..."
              : "Đăng nhập"}
          </button>
        </form>

        <div
          style={{
            margin: "18px 0",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              height: "1px",
              flex: 1,
              background: "#e2e8f0",
            }}
          />

          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#94a3b8",
            }}
          >
            hoặc
          </span>

          <div
            style={{
              height: "1px",
              flex: 1,
              background: "#e2e8f0",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            opacity: googleSubmitting ? 0.6 : 1,
            pointerEvents: googleSubmitting
              ? "none"
              : "auto",
          }}
        >
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError(
                "Đăng nhập Google thất bại",
              );
            }}
            text="signin_with"
            shape="pill"
            width="320"
          />
        </div>

        {isSchool ? (
          <p className="switch-portal">
            Bạn là phụ huynh?{" "}
            <Link to="/login/parent">
              Đăng nhập tại đây
            </Link>
          </p>
        ) : (
          <p className="switch-portal">
            Bạn là giáo viên/nhân viên?{" "}
            <Link to="/login/school">
              Đăng nhập cổng trường
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}