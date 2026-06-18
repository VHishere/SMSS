import { useEffect, useState } from "react";
import { behaviourApi } from "../api/client";

export function useBehaviourAnalytics(classId, semesterId, enabled = true, refreshKey = 0) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!enabled || !classId || !semesterId) return;

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    behaviourApi
      .getAnalytics(classId, semesterId)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [classId, semesterId, enabled, refreshKey]);

  return { data, loading, error };
}
