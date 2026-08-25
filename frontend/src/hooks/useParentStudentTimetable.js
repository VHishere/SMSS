import { useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentTimetable(studentId, date = "", pollMs = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) return;

    let isMounted = true;
    const load = () => parentApi
      .getStudentTimetable(studentId, date ? { date } : {})
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

    load();
    const timer = pollMs > 0 ? window.setInterval(load, pollMs) : null;

    return () => {
      isMounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [studentId, date, pollMs]);

  return { data, loading, error };
}
