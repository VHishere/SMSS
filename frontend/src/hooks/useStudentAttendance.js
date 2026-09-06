import { useEffect, useState } from "react";

import { studentApi } from "../api/client";

export function useStudentAttendance(filters = {}, refreshKey = 0, pollMs = 0) {
  const [history, setHistory] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const load = () => Promise.all([
      studentApi.getMyAttendanceHistory(filters),
      studentApi.getMyAttendanceAnalytics(filters),
      studentApi
        .getMyLeaveRequests({ page: 1, limit: 5 })
        .catch(() => ({ data: null })),
    ])
      .then(([
        historyResponse,
        analyticsResponse,
        leaveRequestsResponse,
      ]) => {
        if (isMounted) {
          setHistory(historyResponse.data);
          setAnalytics(analyticsResponse.data);
          setLeaveRequests(leaveRequestsResponse.data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    load();
    const timer = pollMs > 0 ? window.setInterval(load, pollMs) : null;

    return () => {
      isMounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [filters, refreshKey, pollMs]);

  return {
    history,
    analytics,
    leaveRequests,
    loading,
    error,
  };
}
