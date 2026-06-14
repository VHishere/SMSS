import { useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudentTimetable(studentId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) return;

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    parentApi
      .getStudentTimetable(studentId)
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
  }, [studentId]);

  return { data, loading, error };
}
