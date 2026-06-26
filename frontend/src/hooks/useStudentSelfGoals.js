import { useEffect, useMemo, useState } from "react";

import { studentApi } from "../api/client";

export function useStudentSelfGoals(filters = {}, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [types, setTypes] = useState([]);
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

    Promise.all([
      studentApi.getMyGoals(filters),
      studentApi.getGoalTypes(),
    ])
      .then(([goalsResponse, typesResponse]) => {
        if (isMounted) {
          setData(goalsResponse.data);
          setTypes(typesResponse.data || []);
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
    types,
    loading,
    error,
  };
}