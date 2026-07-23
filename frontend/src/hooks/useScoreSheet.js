import { useEffect, useState } from "react";
import { academicApi } from "../api/client";

export function useScoreSheet({ classId, subjectId, semesterId, scoreType }, refreshKey = 0) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!classId || !subjectId || !semesterId || !scoreType) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    academicApi
      .getScoreSheet({ classId, subjectId, semesterId, scoreType })
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [classId, subjectId, semesterId, scoreType, refreshKey]);

  return { data, loading, error };
}
