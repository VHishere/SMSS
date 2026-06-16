import { useCallback, useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentLeaveRequests(studentId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refetch = useCallback(() => {
    if (!studentId) return;

    setLoading(true);
    setError("");

    return parentApi
      .getStudentLeaveRequests(studentId, { limit: 50 })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
