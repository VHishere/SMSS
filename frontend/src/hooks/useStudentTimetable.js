import {
  useEffect,
  useState,
} from "react";

import {
  studentApi,
} from "../api/client";

export function useStudentTimetable(date, pollMs = 0) {
  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    const load = () => studentApi
      .getMyTimetable({ date })
      .then((response) => {
        if (isMounted) {
          setData(response.data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(
            requestError.message,
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    load();
    const timer = pollMs > 0 ? window.setInterval(load, pollMs) : null;

    return () => {
      isMounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [date, pollMs]);

  return {
    data,
    loading,
    error,
  };
}
