import { useEffect, useState } from "react";
import { academicApi } from "../api/client";

export function useAcademicWarnings(filters = {}, enabled = true) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const depsKey = JSON.stringify(filters);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    setLoading(true);
    setError("");

    academicApi
      .getWarnings(filters)
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, enabled]);

  return { data, loading, error };
}
