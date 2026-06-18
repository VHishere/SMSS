import { useEffect, useState } from "react";
import { teacherApi } from "../api/client";

export function useLeaveRequestDetail(leaveRequestId, refreshKey = 0) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!leaveRequestId) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError("");

    teacherApi
      .getLeaveRequestDetail(leaveRequestId)
      .then((res) => {
        if (isMounted) setData(res.data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [leaveRequestId, refreshKey]);

  return { data, loading, error };
}
