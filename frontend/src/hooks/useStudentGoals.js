import { useEffect, useState } from "react";
import { goalApi } from "../api/client";

export function useStudentGoals(studentId, filters = {}, refreshKey = 0) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const depsKey = JSON.stringify(filters);

  useEffect(() => {
    if (!studentId) return;

    let isMounted = true;
    setLoading(true);
    setError("");

    goalApi
      .listByStudent(studentId, filters)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, depsKey, refreshKey]);

  return { data, loading, error };
}
