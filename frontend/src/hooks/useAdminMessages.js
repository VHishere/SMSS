import { useEffect, useRef, useState } from "react";

import { adminApi } from "../api/client";

export function useAdminThread(conversationId, refreshKey = 0, api = adminApi) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState("");
  const hasDataRef = useRef(false);

  useEffect(() => {
    hasDataRef.current = Boolean(data);
  }, [data]);

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (!conversationId) {
        setData(null);
        setLoading(false);
        return;
      }

      setLoading((current) => (hasDataRef.current ? current : true));
      setError("");

      api
        .getThread(conversationId)
        .then((response) => { if (isMounted) setData(response.data); })
        .catch((requestError) => { if (isMounted) setError(requestError.message); })
        .finally(() => { if (isMounted) setLoading(false); });
    }, 0);

    return () => { isMounted = false; clearTimeout(timer); };
  }, [conversationId, refreshKey, api]);

  return { data, loading, error };
}
