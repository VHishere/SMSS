import { useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentAttendanceStats(studentId, startDate, endDate, context) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!studentId || !startDate || !endDate) return;

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    const params = { startDate, endDate };
    if (context) params.context = context;

    parentApi
      .getStudentAttendanceAnalytics(studentId, params)
      .then((res) => {
        if (isMounted) setData(res.data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId, startDate, endDate, context]);

  return { data, loading, error };
}
