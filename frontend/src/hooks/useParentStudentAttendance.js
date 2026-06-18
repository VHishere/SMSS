import { useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentAttendance(studentId, startDate, endDate) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId || !startDate || !endDate) return;

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    parentApi
      .getStudentAttendanceHistory(studentId, { startDate, endDate, limit: 50 })
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
  }, [studentId, startDate, endDate]);

  return { data, loading, error };
}
