import { useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentHomework(studentId, params = {}, enabled = true) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const depsKey = JSON.stringify(params);

  useEffect(() => {
    if (!enabled || !studentId) return;
    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");
    parentApi
      .getStudentHomework(studentId, params)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, depsKey, enabled]);

  return { data, loading, error };
}
