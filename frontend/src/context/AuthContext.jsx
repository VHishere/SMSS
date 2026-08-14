import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/client';
import { saveLastPortal } from '../utils/auth';
import { AuthContext } from './authContext2';

const TOKEN_KEY = 'smss_token';
const USER_KEY = 'smss_user';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = sessionStorage.getItem(USER_KEY);
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem(TOKEN_KEY)));

    const logout = useCallback(() => {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        setUser(null);
    }, []);

    const login = useCallback((token, userData) => {
        sessionStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(USER_KEY, JSON.stringify(userData));
        saveLastPortal(userData.portal);
        setUser(userData);
    }, []);

    useEffect(() => {
        const token = sessionStorage.getItem(TOKEN_KEY);
        if (!token) return;

        authApi
            .getMe()
            .then((res) => {
                setUser(res.data);
                sessionStorage.setItem(USER_KEY, JSON.stringify(res.data));
                if (res.data.portal) saveLastPortal(res.data.portal);
            })
            .catch(() => logout())
            .finally(() => setLoading(false));
    }, [logout]);

    const value = useMemo(
        () => ({ user, loading, login, logout, isAuthenticated: Boolean(user) }),
        [user, loading, login, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
