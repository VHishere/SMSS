import { useEffect, useState } from "react";
import { teacherApi } from "../api/client";

export function useLeaveRequests(filters = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const depsKey = JSON.stringify(filters);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    teacherApi
      .getLeaveRequests(filters)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  return { data, loading, error };
}
