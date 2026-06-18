import { useEffect, useState } from "react";
import { studentProfileApi } from "../api/client";

export function useClassOverview(classId, semesterId, enabled = true, refreshKey = 0) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!enabled || !classId) return;

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    studentProfileApi
      .getClassOverview(classId, semesterId)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [classId, semesterId, enabled, refreshKey]);

  return { data, loading, error };
}
