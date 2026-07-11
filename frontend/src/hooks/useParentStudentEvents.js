import { useEffect, useMemo, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentEvents(studentId, filters = {}, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const depsKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    if (!studentId) {
      return;
    }

    let isMounted = true;

    setLoading(true);
    setError("");

    parentApi
      .getStudentEvents(studentId, filters)
      .then((response) => {
        if (isMounted) {
          setData(response.data);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, depsKey, refreshKey]);

  return { data, loading, error };
}
