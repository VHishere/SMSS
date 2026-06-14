import { useContext } from 'react';
import { AuthContext } from './authContext2';

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth phải được dùng trong AuthProvider');
    }
    return context;
}
