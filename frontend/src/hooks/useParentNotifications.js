import { useEffect, useMemo, useState } from "react";

import { parentApi } from "../api/client";

export function useParentNotifications(filters = {}, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const depsKey = useMemo(
    () => JSON.stringify(filters),
    [filters],
  );

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError("");

    parentApi
      .getMyNotifications(filters)
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
  }, [depsKey, refreshKey]);

  return {
    data,
    loading,
    error,
  };
}
