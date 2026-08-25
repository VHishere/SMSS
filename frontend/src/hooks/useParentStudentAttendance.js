import { useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentAttendance(studentId, startDate, endDate, pollMs = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId || !startDate || !endDate) return;

    let isMounted = true;
    const load = () => parentApi
      .getStudentAttendanceHistory(studentId, { startDate, endDate, limit: 500 })
      .then((res) => {
        if (isMounted) { setData(res.data); setError(""); }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    load();
    const timer = pollMs > 0 ? window.setInterval(load, pollMs) : null;

    return () => {
      isMounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [studentId, startDate, endDate, pollMs]);

  return { data, loading, error };
}
