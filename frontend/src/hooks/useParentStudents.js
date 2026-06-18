import { useEffect, useState } from "react";
import { parentApi } from "../api/client";

export function useParentStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    parentApi
      .getMyStudents()
      .then((response) => {
        if (isMounted) {
          setStudents(response.data);
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

  return { students, loading, error };
}
