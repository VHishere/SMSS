import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

export function useAdminBehaviourWarnings(filters = {}, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const depsKey = JSON.stringify(filters);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");

      adminApi
        .getBehaviourWarnings(filters)
        .then((res) => { if (isMounted) setData(res.data); })
        .catch((err) => { if (isMounted) setError(err.message); })
        .finally(() => { if (isMounted) setLoading(false); });
    }, 0);

    return () => { isMounted = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, enabled]);

  return { data, loading, error };
}
