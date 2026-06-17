import { useEffect, useState } from "react";
import { homeworkApi } from "../api/client";

export function useHomeworkSubmissions(homeworkId, refreshKey = 0) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!homeworkId) return;

    let isMounted = true;
    setLoading(true);
    setError("");

    homeworkApi
      .getSubmissions(homeworkId)
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
  }, [homeworkId, refreshKey]);

  return { data, loading, error };
}
