import { useEffect, useState } from "react";
import { academicApi } from "../api/client";

export function useAcademicAnalytics(classId, semesterId, enabled = true, refreshKey = 0) {
  const [data,    setData]    = useState(null);
  const [trend,   setTrend]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!enabled || !classId || !semesterId) return;

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    Promise.all([
      academicApi.getAnalytics(classId, semesterId),
      academicApi.getTrend(classId),
    ])
      .then(([analyticsRes, trendRes]) => {
        if (!isMounted) return;
        setData(analyticsRes.data);
        setTrend(trendRes.data);
      })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [classId, semesterId, enabled, refreshKey]);

  return { data, trend, loading, error };
}
