import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

export function useAdminBehaviourAnalytics(classId, semesterId, enabled = true, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !classId || !semesterId) return;

    let isMounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setData(null);
      setError("");

      adminApi
        .getBehaviourAnalytics(classId, semesterId)
        .then((res) => { if (isMounted) setData(res.data); })
        .catch((err) => { if (isMounted) setError(err.message); })
        .finally(() => { if (isMounted) setLoading(false); });
    }, 0);

    return () => { isMounted = false; clearTimeout(timer); };
  }, [classId, semesterId, enabled, refreshKey]);

  return { data, loading, error };
}
