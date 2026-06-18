import { useEffect, useState } from "react";

import { studentApi } from "../api/client";

export function useStudentProfile() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    studentApi
      .getMyProfile()
      .then((response) => {
        if (isMounted) {
          setData(response.data);
          setError("");
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
  }, []);

  return {
    data,
    loading,
    error,
  };
}