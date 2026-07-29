import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

export function useAdminStudentBehaviour(studentId, semesterId, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) return;

    let isMounted = true;

    const timer = setTimeout(() => {
      setLoading(true);
      setError("");

      adminApi
        .getStudentBehaviour(studentId, semesterId)
        .then((res) => { if (isMounted) setData(res.data); })
        .catch((err) => { if (isMounted) setError(err.message); })
        .finally(() => { if (isMounted) setLoading(false); });
    }, 0);

    return () => { isMounted = false; clearTimeout(timer); };
  }, [studentId, semesterId, refreshKey]);

  return { data, loading, error };
}
