import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

export function useAdminAttendanceOverview(classId, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!classId) return;

    let isMounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setData(null);
      setError("");

      adminApi
        .getAttendanceClassOverview(classId)
        .then((res) => { if (isMounted) setData(res.data); })
        .catch((err) => { if (isMounted) setError(err.message); })
        .finally(() => { if (isMounted) setLoading(false); });
    }, 0);

    return () => { isMounted = false; clearTimeout(timer); };
  }, [classId, refreshKey]);

  return { data, loading, error };
}
