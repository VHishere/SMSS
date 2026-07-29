import { useCallback, useEffect, useState } from "react";

import { parentApi } from "../api/client";

export function useParentStudentGrades(studentId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refetch = useCallback(() => {
    if (!studentId) return;

    setLoading(true);
    setError("");

    return parentApi
      .getStudentGrades(studentId)
      .then((response) => setData(response.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
