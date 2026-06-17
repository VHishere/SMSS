import { useEffect, useState } from "react";
import { homeworkApi } from "../api/client";

export function useHomeworkAnalytics(homeworkId, enabled = true, refreshKey = 0) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!homeworkId || !enabled) return;

    let isMounted = true;
    setLoading(true);
    setError("");

    homeworkApi
      .getAnalytics(homeworkId)
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
  }, [homeworkId, enabled, refreshKey]);

  return { data, loading, error };
}
