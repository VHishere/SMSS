import { useEffect, useState } from "react";
import { teacherApi } from "../api/client";

export function useAttendanceHistory(classId, filters = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const depsKey = JSON.stringify({ classId, ...filters });

  useEffect(() => {
    if (!classId) return;

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    teacherApi
      .getAttendanceHistory(classId, filters)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  return { data, loading, error };
}
