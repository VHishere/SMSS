import { useCallback, useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentLeaveRequests(studentId, params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const depsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    if (!studentId) return;

    setLoading(true);
    setError("");

    return parentApi
      .getStudentLeaveRequests(studentId, { limit: 50, ...params })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, depsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
