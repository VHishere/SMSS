import { useEffect, useRef, useState } from "react";

import { adminApi } from "../api/client";

export function useAdminThread(conversationId, api = adminApi) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const hasDataRef = useRef(false);

  const reload = () => setReloadKey((current) => current + 1);

  useEffect(() => {
    hasDataRef.current = Boolean(data);
  }, [data]);

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (!conversationId) {
        setData(null);
        setLoading(false);
        setError("");
        return;
      }

      setLoading((current) => (hasDataRef.current ? current : true));
      setError("");

      api
        .getThread(conversationId, { limit: 100 })
        .then((response) => { if (isMounted) setData(response.data); })
        .catch((requestError) => { if (isMounted) setError(requestError.message); })
        .finally(() => { if (isMounted) setLoading(false); });
    }, 0);

    return () => { isMounted = false; clearTimeout(timer); };
  }, [conversationId, reloadKey, api]);

  return { data, setData, loading, error, reload };
}
