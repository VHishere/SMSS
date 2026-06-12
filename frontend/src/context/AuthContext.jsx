import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/client';
import { saveLastPortal } from '../utils/auth';
import { AuthContext } from './authContext2';

const TOKEN_KEY = 'kidcare_token';
const USER_KEY = 'kidcare_user';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem(USER_KEY);
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
    }, []);

    const login = useCallback((token, userData) => {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        saveLastPortal(userData.portal);
        setUser(userData);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;

        authApi
            .getMe()
            .then((res) => {
                setUser(res.data);
                localStorage.setItem(USER_KEY, JSON.stringify(res.data));
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
