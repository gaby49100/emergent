// App.js - Application principale avec routing et pages admin
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MyTorrentsPage from './pages/MyTorrentsPage';
import AllTorrentsPage from './pages/AllTorrentsPage';
import JackettSearchPage from './pages/JackettSearchPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminGroupsPage from './pages/AdminGroupsPage';
import './App.css';

// Route protégée - redirige vers login si non authentifié
const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { isAuthenticated, loading, user } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-8 h-8 spinner" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && user?.role !== 'admin') {
        return <Navigate to="/dashboard" replace />;
    }

    return <Layout>{children}</Layout>;
};

// Route publique - redirige vers dashboard si déjà authentifié
const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-8 h-8 spinner" />
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

function AppRoutes() {
    return (
        <Routes>
            {/* Routes publiques */}
            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <LoginPage />
                    </PublicRoute>
                }
            />

            {/* Routes protégées - Utilisateurs */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <DashboardPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/my-torrents"
                element={
                    <ProtectedRoute>
                        <MyTorrentsPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/all-torrents"
                element={
                    <ProtectedRoute>
                        <AllTorrentsPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/search"
                element={
                    <ProtectedRoute>
                        <JackettSearchPage />
                    </ProtectedRoute>
                }
            />

            {/* Routes Admin */}
            <Route
                path="/admin/settings"
                element={
                    <ProtectedRoute adminOnly>
                        <AdminSettingsPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/users"
                element={
                    <ProtectedRoute adminOnly>
                        <AdminUsersPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/groups"
                element={
                    <ProtectedRoute adminOnly>
                        <AdminGroupsPage />
                    </ProtectedRoute>
                }
            />

            {/* Redirection par défaut */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
                <Toaster position="top-right" richColors />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
