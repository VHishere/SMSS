import { useEffect, useState } from "react";

import {
  studentApi,
  studentProfileApi,
} from "../api/client";

export function useStudentProfile(
  studentId,
  semesterId,
  refreshKey = 0,
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isSelfProfile = typeof studentId === "undefined";

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError("");

    if (!isSelfProfile && !studentId) {
      setData(null);
      setLoading(false);

      return () => {
        isMounted = false;
      };
    }

    const request = isSelfProfile
      ? studentApi.getMyProfile()
      : studentProfileApi.getProfile(
          studentId,
          semesterId,
        );

    request
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
  }, [
    isSelfProfile,
    studentId,
    semesterId,
    refreshKey,
  ]);

  return {
    data,
    loading,
    error,
  };
}