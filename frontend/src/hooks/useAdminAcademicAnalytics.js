import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

export function useAdminAcademicAnalytics(classId, semesterId, enabled = true, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !classId || !semesterId) return;

    let isMounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setData(null);
      setError("");

      Promise.all([
        adminApi.getAcademicAnalytics(classId, semesterId),
        adminApi.getAcademicTrend(classId),
      ])
        .then(([analyticsRes, trendRes]) => {
          if (!isMounted) return;
          setData(analyticsRes.data);
          setTrend(trendRes.data);
        })
        .catch((err) => { if (isMounted) setError(err.message); })
        .finally(() => { if (isMounted) setLoading(false); });
    }, 0);

    return () => { isMounted = false; clearTimeout(timer); };
  }, [classId, semesterId, enabled, refreshKey]);

  return { data, trend, loading, error };
}
