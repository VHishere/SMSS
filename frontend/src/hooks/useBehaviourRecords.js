import { useEffect, useState } from "react";
import { behaviourApi } from "../api/client";

export function useBehaviourRecords(filters = {}, enabled = true) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const depsKey = JSON.stringify(filters);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    setLoading(true);
    setError("");

    behaviourApi
      .listRecords(filters)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, enabled]);

  return { data, loading, error };
}
