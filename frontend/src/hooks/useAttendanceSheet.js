import { useEffect, useState } from "react";
import { teacherApi } from "../api/client";

export function useAttendanceSheet(classId, date) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!classId || !date) return;

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    teacherApi
      .getAttendanceSheet(classId, date)
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
  }, [classId, date]);

  return { data, loading, error };
}
