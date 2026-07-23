import { useEffect, useState } from "react";
import { teacherApi } from "../api/client";

export function useTeacherClasses() {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    teacherApi
      .getMyProfile()
      .then((res) => {
        if (isMounted) setProfile(res.data);
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
  }, []);

  return { profile, loading, error };
}
