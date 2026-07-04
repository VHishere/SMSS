import { useEffect, useState } from "react";

import { parentApi } from "../api/client";

export function useParentMessages(refreshKey = 0) {
  const [contacts, setContacts] = useState(null);
  const [conversations, setConversations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError("");

    Promise.all([
      parentApi.getMessageContacts(),
      parentApi.listConversations(),
    ])
      .then(([contactsResponse, conversationsResponse]) => {
        if (isMounted) {
          setContacts(contactsResponse.data);
          setConversations(conversationsResponse.data);
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
  }, [refreshKey]);

  return {
    contacts,
    conversations,
    loading,
    error,
  };
}

export function useParentThread(conversationId, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!conversationId) {
      setData(null);
      setLoading(false);
      return undefined;
    }

    let isMounted = true;

    setLoading(true);
    setError("");

    parentApi
      .getThread(conversationId)
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
  }, [conversationId, refreshKey]);

  return {
    data,
    loading,
    error,
  };
}
