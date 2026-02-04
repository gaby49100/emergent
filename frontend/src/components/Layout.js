// Layout - Composant de mise en page avec sidebar et menu admin
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
    LayoutDashboard,
    Download,
    Users,
    Search,
    Bell,
    LogOut,
    Menu,
    X,
    User,
    Check,
    Settings,
    Shield,
    UsersRound
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const isAdmin = user?.role === 'admin';

    const navItems = [
        { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
        { path: '/my-torrents', label: 'Mes torrents', icon: Download },
        { path: '/all-torrents', label: 'Tous les torrents', icon: Users },
        { path: '/search', label: 'Recherche Jackett', icon: Search }
    ];

    const adminItems = [
        { path: '/admin/settings', label: 'Paramètres', icon: Settings },
        { path: '/admin/users', label: 'Utilisateurs', icon: UsersRound },
        { path: '/admin/groups', label: 'Groupes', icon: Shield }
    ];

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const [notifRes, countRes] = await Promise.all([
                    axios.get(`${API}/notifications/`),
                    axios.get(`${API}/notifications/unread-count`)
                ]);
                setNotifications(notifRes.data.slice(0, 10));
                setUnreadCount(countRes.data.count);
            } catch (error) {
                console.error('Erreur chargement notifications:', error);
            }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkAsRead = async (notificationId) => {
        try {
            await axios.post(`${API}/notifications/${notificationId}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await axios.post(`${API}/notifications/read-all`);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile menu button */}
            <button
                className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-card border border-border"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                data-testid="mobile-menu-btn"
            >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Sidebar */}
            <aside
                className={`sidebar ${sidebarOpen ? 'open' : ''}`}
                data-testid="sidebar"
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="p-6 border-b border-border">
                        <Link to="/dashboard" className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Download className="w-6 h-6 text-primary" />
                            </div>
                            <span className="text-xl font-black">QBitMaster</span>
                        </Link>
                    </div>

                    {/* Navigation */}
                    <ScrollArea className="flex-1 p-4">
                        <nav className="space-y-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                                    onClick={() => setSidebarOpen(false)}
                                    data-testid={`nav-${item.path.slice(1)}`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Admin Section */}
                        {isAdmin && (
                            <>
                                <Separator className="my-4" />
                                <div className="mb-2">
                                    <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Administration
                                    </span>
                                </div>
                                <nav className="space-y-1">
                                    {adminItems.map((item) => (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                                            onClick={() => setSidebarOpen(false)}
                                            data-testid={`nav-${item.path.replace('/admin/', 'admin-')}`}
                                        >
                                            <item.icon className="w-5 h-5" />
                                            {item.label}
                                        </Link>
                                    ))}
                                </nav>
                            </>
                        )}
                    </ScrollArea>

                    {/* User section */}
                    <div className="p-4 border-t border-border">
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div className="p-2 rounded-full bg-secondary">
                                <User className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">{user?.username}</p>
                                    {isAdmin && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/20 text-primary">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-30"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main content */}
            <div className="main-content">
                {/* Top bar */}
                <header className="flex items-center justify-end gap-4 mb-6 lg:mb-8">
                    {/* Notifications */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="relative" data-testid="notifications-btn">
                                <Bell className="w-4 h-4" />
                                {unreadCount > 0 && (
                                    <span className="notification-dot" data-testid="notification-badge" />
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-80" data-testid="notifications-dropdown">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                                <span className="font-semibold">Notifications</span>
                                {unreadCount > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleMarkAllAsRead}
                                        className="text-xs"
                                    >
                                        Tout marquer lu
                                    </Button>
                                )}
                            </div>
                            <ScrollArea className="max-h-64">
                                {notifications.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        Aucune notification
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`p-3 border-b border-border last:border-0 ${
                                                !notification.read ? 'bg-primary/5' : ''
                                            }`}
                                            data-testid={`notification-${notification.id}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm truncate">{notification.message}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {new Date(notification.created_at).toLocaleString('fr-FR')}
                                                    </p>
                                                </div>
                                                {!notification.read && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 shrink-0"
                                                        onClick={() => handleMarkAsRead(notification.id)}
                                                    >
                                                        <Check className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </ScrollArea>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* User menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" data-testid="user-menu-btn">
                                <User className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <div className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium">{user?.username}</p>
                                    {isAdmin && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/20 text-primary">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">{user?.email}</p>
                                {user?.group_name && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Groupe: {user.group_name}
                                    </p>
                                )}
                            </div>
                            <DropdownMenuSeparator />
                            {isAdmin && (
                                <>
                                    <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
                                        <Settings className="w-4 h-4 mr-2" />
                                        Administration
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn">
                                <LogOut className="w-4 h-4 mr-2" />
                                Déconnexion
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </header>

                {/* Page content */}
                <main>{children}</main>
            </div>
        </div>
    );
};

export default Layout;
