import { useEffect, useState } from "react";
import { teacherApi } from "../api/client";

export function useAttendanceAnalytics(classId, startDate, endDate) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!classId || !startDate || !endDate) return;

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    teacherApi
      .getAttendanceAnalytics(classId, { startDate, endDate })
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
  }, [classId, startDate, endDate]);

  return { data, loading, error };
}
