import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginUser, logout, isAuthenticated, LoginRequest } from '../services/authService';

interface UserClaims {
    sub?: string;
    email?: string;
    name?: string;
    roles: string[]; // all role claims
    primaryRole?: string; // convenience
    exp?: number; // epoch seconds
    iss?: string;
    aud?: string;
    // derived helpers
    expiresAt?: Date;
    isExpired: boolean;
}

interface AuthState {
    loading: boolean;
    authenticated: boolean;
    token: string | null;
    claims: UserClaims | null;
    roles: string[];
    hasRole: (role: string) => boolean;
    hasAnyRole: (...roles: string[]) => boolean;
    hasAllRoles: (...roles: string[]) => boolean;
    login: (req: LoginRequest) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<UserClaims | null>(null);

    // Base64URL decode helper
    function decodeSegment(seg: string): string {
        seg = seg.replace(/-/g, '+').replace(/_/g, '/');
        try {
            // pad
            while (seg.length % 4) seg += '=';
            if (typeof atob === 'function') return atob(seg);
            // @ts-expect-error node fallback
            if (typeof Buffer !== 'undefined') return Buffer.from(seg, 'base64').toString('utf-8');
        } catch { /* ignore */ }
        return '';
    }

    const decodeJwt = useCallback((t: string): UserClaims | null => {
        const parts = t.split('.');
        if (parts.length < 2) return null;
        try {
            const json = decodeSegment(parts[1]);
            const data = JSON.parse(json) as Record<string, unknown>;
            const exp = typeof data.exp === 'number' ? data.exp : undefined;
            const expiresAt = exp ? new Date(exp * 1000) : undefined;
            const now = Date.now();

            // Extract roles (could be single string, array, or namespaced key)
            const roleKeyNamespace = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
            const getProp = (k: string): unknown => (Object.prototype.hasOwnProperty.call(data, k) ? (data as Record<string, unknown>)[k] : undefined);
            const rawRoles = ((): unknown => {
                const roleProp = getProp('role');
                const rolesProp = getProp('roles');
                const nsRoleProp = getProp(roleKeyNamespace);
                if (Array.isArray(roleProp)) return roleProp;
                if (Array.isArray(rolesProp)) return rolesProp;
                if (Array.isArray(nsRoleProp)) return nsRoleProp;
                if (typeof roleProp === 'string') return [roleProp];
                if (typeof rolesProp === 'string') return [rolesProp];
                if (typeof nsRoleProp === 'string') return [nsRoleProp];
                return [];
            })();
            const roles: string[] = Array.isArray(rawRoles)
                ? rawRoles.filter(r => typeof r === 'string').map(r => r as string)
                : [];

            const claims: UserClaims = {
                sub: typeof data.sub === 'string' ? data.sub : undefined,
                email: typeof data.email === 'string' ? data.email : undefined,
                name: typeof data['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] === 'string'
                    ? data['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string
                    : (typeof data.name === 'string' ? data.name : undefined),
                roles,
                primaryRole: roles[0],
                exp,
                iss: typeof data.iss === 'string' ? data.iss : undefined,
                aud: typeof data.aud === 'string' ? data.aud : undefined,
                expiresAt,
                isExpired: exp ? (now >= exp * 1000) : false,
            };
            return claims;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        const init = () => {
            if (isAuthenticated()) {
                try {
                    const stored = localStorage.getItem('access_token');
                    setToken(stored);
                } catch { /* ignore */ }
            }
            setLoading(false);
        };
        init();
    }, []);

    // derive claims when token changes
    useEffect(() => {
        if (token) {
            const c = decodeJwt(token);
            setClaims(c);
        } else {
            setClaims(null);
        }
    }, [token, decodeJwt]);

    const login = useCallback(async (req: LoginRequest) => {
        try {
            const res = await loginUser(req);
            if (res.success && res.token) {
                setToken(res.token);
                return { success: true };
            }
            return { success: false, error: res.error || 'Login failed' };
        } catch (e: unknown) {
            const msg = (e as { message?: string }).message || 'Login error';
            return { success: false, error: msg };
        }
    }, []);

    const doLogout = useCallback(() => {
        logout();
        setToken(null);
    }, []);

    // Logout immediately if the app detects no internet connection
    useEffect(() => {
        const handleOffline = () => {
            // Only act if we currently have a token/auth
            if (isAuthenticated()) {
                alert('No internet connection. You will be logged out for security.');
                doLogout();
            }
        };

        // If already offline on mount, logout
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            handleOffline();
        }

        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('offline', handleOffline);
        };
    }, [doLogout]);

    const hasRole = useCallback((role: string) => !!claims?.roles.includes(role), [claims]);
    const hasAnyRole = useCallback((...r: string[]) => r.some(x => hasRole(x)), [hasRole]);
    const hasAllRoles = useCallback((...r: string[]) => r.every(x => hasRole(x)), [hasRole]);

    const value = useMemo<AuthState>(() => ({
        loading,
        authenticated: !!token && !(claims?.isExpired),
        token,
        claims,
        roles: claims?.roles || [],
        hasRole,
        hasAnyRole,
        hasAllRoles,
        login,
        logout: doLogout,
    }), [loading, token, claims, hasRole, hasAnyRole, hasAllRoles, login, doLogout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
