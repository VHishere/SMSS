import { useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentBehaviourSemesters(studentId) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!studentId) return;
    let isMounted = true;
    setLoading(true);
    setError("");
    parentApi
      .getStudentBehaviourSemesters(studentId)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [studentId]);

  return { data, loading, error };
}
