import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { studentApi } from "../api/client";

export function useStudentMessages(
  refreshKey = 0,
) {
  const [contacts, setContacts] =
    useState(null);

  const [
    conversations,
    setConversations,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError("");

    Promise.all([
      studentApi.getMessageContacts(),
      studentApi.listConversations(),
    ])
      .then(
        ([
          contactsResponse,
          conversationsResponse,
        ]) => {
          if (!isMounted) return;

          setContacts(
            contactsResponse.data,
          );

          setConversations(
            conversationsResponse.data,
          );
        },
      )
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

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  return {
    contacts,
    conversations,
    loading,
    error,
  };
}

export function useStudentThread(
  conversationId,
) {
  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(Boolean(conversationId));

  const [error, setError] =
    useState("");

  const [
    reloadKey,
    setReloadKey,
  ] = useState(0);

  const reload = useCallback(() => {
    setReloadKey(
      (current) => current + 1,
    );
  }, []);

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

    studentApi
      .getThread(
        conversationId,
        {
          limit: 100,
        },
      )
      .then((response) => {
        if (isMounted) {
          setData(response.data);
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

    return () => {
      isMounted = false;
    };
  }, [
    conversationId,
    reloadKey,
  ]);

  return {
    data,
    setData,
    loading,
    error,
    reload,
  };
}