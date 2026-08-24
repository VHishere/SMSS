import { useEffect, useMemo, useState } from "react";

import { studentApi } from "../api/client";

export function useStudentAttendance(filters = {}, refreshKey = 0) {
  const [history, setHistory] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const depsKey = useMemo(
    () => JSON.stringify(filters),
    [filters],
  );

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError("");

    Promise.all([
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

    return () => {
      isMounted = false;
    };
  }, [depsKey, refreshKey]);

  return {
    history,
    analytics,
    leaveRequests,
    loading,
    error,
  };
}
