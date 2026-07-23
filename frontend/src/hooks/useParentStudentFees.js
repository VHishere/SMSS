import { useCallback, useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentFees(params = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const depsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    setLoading(true);
    setError("");

    return parentApi
      .getStudentFees(params)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
