// AdminUsersPage - Gestion des utilisateurs
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose
} from '../components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
    Users,
    Search,
    MoreVertical,
    Edit,
    Trash2,
    Key,
    Shield,
    User,
    UserCheck,
    UserX,
    Copy
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [tempPassword, setTempPassword] = useState(null);

    // Edit form state
    const [editUsername, setEditUsername] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editRole, setEditRole] = useState('user');
    const [editGroupId, setEditGroupId] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [usersRes, groupsRes] = await Promise.all([
                axios.get(`${API}/admin/users`),
                axios.get(`${API}/admin/groups`)
            ]);
            setUsers(usersRes.data);
            setGroups(groupsRes.data);
        } catch (error) {
            console.error('Erreur:', error);
            toast.error('Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openEditDialog = (user) => {
        setEditingUser(user);
        setEditUsername(user.username);
        setEditEmail(user.email);
        setEditRole(user.role || 'user');
        setEditGroupId(user.group_id || '');
        setEditIsActive(user.is_active !== false);
        setEditDialogOpen(true);
    };

    const handleUpdateUser = async () => {
        try {
            await axios.put(`${API}/admin/users/${editingUser.id}`, {
                username: editUsername,
                email: editEmail,
                role: editRole,
                group_id: editGroupId || null,
                is_active: editIsActive
            });
            toast.success('Utilisateur mis à jour');
            setEditDialogOpen(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${username}" ?`)) {
            return;
        }

        try {
            await axios.delete(`${API}/admin/users/${userId}`);
            toast.success('Utilisateur supprimé');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
        }
    };

    const handleResetPassword = async (userId, username) => {
        if (!window.confirm(`Réinitialiser le mot de passe de "${username}" ?`)) {
            return;
        }

        try {
            const response = await axios.post(`${API}/admin/users/${userId}/reset-password`);
            setTempPassword(response.data.temporary_password);
            toast.success('Mot de passe réinitialisé');
        } catch (error) {
            toast.error('Erreur lors de la réinitialisation');
        }
    };

    const copyPassword = () => {
        navigator.clipboard.writeText(tempPassword);
        toast.success('Mot de passe copié !');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 spinner" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="admin-users-page">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black">Utilisateurs</h1>
                    <p className="text-muted-foreground mt-1">Gérez les comptes utilisateurs</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Rechercher un utilisateur..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="search-users-input"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="stat-card">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Users className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total</p>
                                <p className="text-lg font-bold">{users.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="stat-card">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[hsl(var(--success))]/10">
                                <UserCheck className="w-5 h-5 text-[hsl(var(--success))]" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Actifs</p>
                                <p className="text-lg font-bold">{users.filter(u => u.is_active !== false).length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="stat-card">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[hsl(var(--warning))]/10">
                                <Shield className="w-5 h-5 text-[hsl(var(--warning))]" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Admins</p>
                                <p className="text-lg font-bold">{users.filter(u => u.role === 'admin').length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="stat-card">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-destructive/10">
                                <UserX className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Inactifs</p>
                                <p className="text-lg font-bold">{users.filter(u => u.is_active === false).length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{filteredUsers.length} utilisateur(s)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="torrent-table" data-testid="users-table">
                            <thead>
                                <tr>
                                    <th>Utilisateur</th>
                                    <th>Email</th>
                                    <th>Rôle</th>
                                    <th>Groupe</th>
                                    <th>Statut</th>
                                    <th>Inscription</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} data-testid={`user-row-${user.id}`}>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-full bg-secondary">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <span className="font-medium">{user.username}</span>
                                            </div>
                                        </td>
                                        <td className="text-muted-foreground">{user.email}</td>
                                        <td>
                                            <span className={`status-badge ${user.role === 'admin' ? 'status-downloading' : 'status-paused'}`}>
                                                {user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                                            </span>
                                        </td>
                                        <td className="text-muted-foreground">
                                            {user.group_name || '-'}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${user.is_active !== false ? 'status-completed' : 'status-error'}`}>
                                                {user.is_active !== false ? 'Actif' : 'Inactif'}
                                            </span>
                                        </td>
                                        <td className="text-sm text-muted-foreground">
                                            {new Date(user.created_at).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                                        <Edit className="w-4 h-4 mr-2" />
                                                        Modifier
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleResetPassword(user.id, user.username)}>
                                                        <Key className="w-4 h-4 mr-2" />
                                                        Réinitialiser MDP
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeleteUser(user.id, user.username)}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Supprimer
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent data-testid="edit-user-dialog">
                    <DialogHeader>
                        <DialogTitle>Modifier l'utilisateur</DialogTitle>
                        <DialogDescription>
                            Modifiez les informations de l'utilisateur
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nom d'utilisateur</Label>
                            <Input
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                data-testid="edit-username-input"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                data-testid="edit-email-input"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Rôle</Label>
                            <Select value={editRole} onValueChange={setEditRole}>
                                <SelectTrigger data-testid="edit-role-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">Utilisateur</SelectItem>
                                    <SelectItem value="admin">Administrateur</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Groupe</Label>
                            <Select value={editGroupId} onValueChange={setEditGroupId}>
                                <SelectTrigger data-testid="edit-group-select">
                                    <SelectValue placeholder="Sélectionner un groupe" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun groupe</SelectItem>
                                    {groups.map((group) => (
                                        <SelectItem key={group.id} value={group.id}>
                                            {group.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="edit-active"
                                checked={editIsActive}
                                onCheckedChange={setEditIsActive}
                                data-testid="edit-active-switch"
                            />
                            <Label htmlFor="edit-active">Compte actif</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Annuler</Button>
                        </DialogClose>
                        <Button onClick={handleUpdateUser} data-testid="save-user-btn">
                            Sauvegarder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Temporary Password Dialog */}
            <Dialog open={!!tempPassword} onOpenChange={() => setTempPassword(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mot de passe temporaire</DialogTitle>
                        <DialogDescription>
                            Communiquez ce mot de passe à l'utilisateur. Il devra le changer lors de sa prochaine connexion.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center gap-2 p-4 bg-secondary rounded-lg">
                        <code className="flex-1 font-mono text-lg">{tempPassword}</code>
                        <Button variant="outline" size="icon" onClick={copyPassword}>
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setTempPassword(null)}>Fermer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminUsersPage;
