import { useEffect, useState } from "react";

import { studentApi } from "../api/client";

export function useStudentDashboard(refreshKey = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError("");

    studentApi
      .getMyDashboard()
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
  }, [refreshKey]);

  return {
    data,
    loading,
    error,
  };
}