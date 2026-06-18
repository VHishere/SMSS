import { useEffect, useState } from "react";
import { reportApi } from "../api/client";

export function useReportMeta() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    let isMounted = true;
    reportApi
      .getMeta()
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => { if (isMounted) setError(err.message); })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, []);

  return { data, loading, error };
}
