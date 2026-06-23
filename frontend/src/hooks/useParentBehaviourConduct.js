import { useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentBehaviourConduct(studentId, semesterId) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!studentId || !semesterId) return;
    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");
    parentApi
      .getStudentBehaviourConduct(studentId, semesterId)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [studentId, semesterId]);

  return { data, loading, error };
}
