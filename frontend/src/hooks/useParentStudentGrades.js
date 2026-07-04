import { useEffect, useState } from "react";

import { parentApi } from "../api/client";

export function useParentStudentGrades() {
  const [data, setData] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    parentApi
      .getMyStudents()
      .then((response) => {
        const students = response.data || [];

        if (students.length === 0) {
          throw new Error("Không tìm thấy học sinh liên kết");
        }

        const primary = students.find((s) => s.isPrimary) || students[0];

        if (isMounted) {
          setStudentInfo(primary);
        }

        return parentApi.getStudentGrades(primary.studentId);
      })
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

  return { data, studentInfo, loading, error };
}
