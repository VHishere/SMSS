import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/client";

export function useAdminNotifications(filters = {}, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const depsKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");

      adminApi
        .getMyNotifications(filters)
        .then((res) => { if (isMounted) setData(res.data); })
        .catch((err) => { if (isMounted) setError(err.message); })
        .finally(() => { if (isMounted) setLoading(false); });
    }, 0);

    return () => { isMounted = false; clearTimeout(timer); };
  }, [depsKey, refreshKey]);

  return { data, loading, error };
}
