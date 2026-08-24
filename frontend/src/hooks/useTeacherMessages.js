import { useEffect, useState } from "react";

import { communicationApi } from "../api/client";

// Bản dành cho GIÁO VIÊN / QUẢN NHIỆM của useParentThread — cùng hợp đồng
// { data, setData, loading, error, reload } để màn Liên lạc dùng chung một
// thiết kế UI với học sinh & phụ huynh, chỉ khác endpoint nạp hội thoại.
export function useTeacherThread(conversationId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((current) => current + 1);

  useEffect(() => {
    if (!conversationId) {
      setData(null);
      setLoading(false);
      setError("");
      return undefined;
    }

    let isMounted = true;

    setLoading(true);
    setError("");

    communicationApi
      .getThread(conversationId, { limit: 100 })
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
  }, [conversationId, reloadKey]);

  return {
    data,
    setData,
    loading,
    error,
    reload,
  };
}
