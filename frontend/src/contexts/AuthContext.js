// AuthContext - Gestion de l'authentification JWT
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Configure axios avec le token
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    // Vérifier le token au démarrage
    const checkAuth = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await axios.get(`${API}/auth/me`);
            setUser(response.data);
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Inscription
    const register = async (username, email, password) => {
        const response = await axios.post(`${API}/auth/register`, {
            username,
            email,
            password
        });
        
        const { access_token, user: userData } = response.data;
        localStorage.setItem('token', access_token);
        setToken(access_token);
        setUser(userData);
        
        return userData;
    };

    // Connexion
    const login = async (email, password) => {
        const response = await axios.post(`${API}/auth/login`, {
            email,
            password
        });
        
        const { access_token, user: userData } = response.data;
        localStorage.setItem('token', access_token);
        setToken(access_token);
        setUser(userData);
        
        return userData;
    };

    // Déconnexion
    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    const value = {
        user,
        token,
        loading,
        isAuthenticated: !!user,
        register,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
