import { useEffect, useState } from "react";
import { behaviourApi } from "../api/client";

export function useStudentBehaviour(studentId, semesterId, refreshKey = 0) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!studentId) return;

    let isMounted = true;
    setLoading(true);
    setError("");

    behaviourApi
      .getStudentBehaviour(studentId, semesterId)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [studentId, semesterId, refreshKey]);

  return { data, loading, error };
}
