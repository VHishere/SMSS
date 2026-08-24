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

    Promise.all([
      studentApi.getMyDashboard(),

      studentApi
        .getMyTimetable()
        .catch(() => ({
          data: null,
        })),

      studentApi
        .getMyHomeworks()
        .catch(() => ({
          data: null,
        })),

      studentApi
        .getMyBehaviour()
        .catch(() => ({
          data: null,
        })),
    ])
      .then(
        ([
          dashboardResponse,
          timetableResponse,
          homeworkResponse,
          behaviourResponse,
        ]) => {
          if (!isMounted) return;

          setData({
            ...dashboardResponse.data,
            timetable: timetableResponse.data,
            homeworkItems:
              homeworkResponse.data?.homeworks || [],
            behaviour: behaviourResponse.data,
          });
        },
      )
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
