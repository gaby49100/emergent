// AdminGroupsPage - Gestion des groupes utilisateurs
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from '../components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
    Users,
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    Download,
    Upload,
    Search,
    Eye
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatSpeed = (kbps) => {
    if (kbps === 0) return 'Illimité';
    if (kbps < 1024) return `${kbps} KB/s`;
    return `${(kbps / 1024).toFixed(1)} MB/s`;
};

const AdminGroupsPage = () => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formMaxTorrents, setFormMaxTorrents] = useState(100);
    const [formMaxDownload, setFormMaxDownload] = useState(0);
    const [formMaxUpload, setFormMaxUpload] = useState(0);
    const [formCanUseJackett, setFormCanUseJackett] = useState(true);
    const [formCanSeeAll, setFormCanSeeAll] = useState(true);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await axios.get(`${API}/admin/groups`);
            setGroups(response.data);
        } catch (error) {
            console.error('Erreur:', error);
            toast.error('Erreur lors du chargement des groupes');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormName('');
        setFormDescription('');
        setFormMaxTorrents(100);
        setFormMaxDownload(0);
        setFormMaxUpload(0);
        setFormCanUseJackett(true);
        setFormCanSeeAll(true);
        setEditingGroup(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setDialogOpen(true);
    };

    const openEditDialog = (group) => {
        setEditingGroup(group);
        setFormName(group.name);
        setFormDescription(group.description || '');
        setFormMaxTorrents(group.max_torrents);
        setFormMaxDownload(group.max_download_speed);
        setFormMaxUpload(group.max_upload_speed);
        setFormCanUseJackett(group.can_use_jackett);
        setFormCanSeeAll(group.can_see_all_torrents);
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!formName.trim()) {
            toast.error('Le nom du groupe est requis');
            return;
        }

        try {
            const data = {
                name: formName,
                description: formDescription,
                max_torrents: formMaxTorrents,
                max_download_speed: formMaxDownload,
                max_upload_speed: formMaxUpload,
                can_use_jackett: formCanUseJackett,
                can_see_all_torrents: formCanSeeAll
            };

            if (editingGroup) {
                await axios.put(`${API}/admin/groups/${editingGroup.id}`, data);
                toast.success('Groupe mis à jour');
            } else {
                await axios.post(`${API}/admin/groups`, data);
                toast.success('Groupe créé');
            }

            setDialogOpen(false);
            resetForm();
            fetchGroups();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
        }
    };

    const handleDelete = async (groupId, groupName) => {
        if (groupName === 'Défaut') {
            toast.error('Le groupe par défaut ne peut pas être supprimé');
            return;
        }

        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le groupe "${groupName}" ?`)) {
            return;
        }

        try {
            await axios.delete(`${API}/admin/groups/${groupId}`);
            toast.success('Groupe supprimé');
            fetchGroups();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 spinner" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="admin-groups-page">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black">Groupes</h1>
                    <p className="text-muted-foreground mt-1">Gérez les groupes et leurs permissions</p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreateDialog} data-testid="create-group-btn">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouveau groupe
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md" data-testid="group-dialog">
                        <DialogHeader>
                            <DialogTitle>
                                {editingGroup ? 'Modifier le groupe' : 'Créer un groupe'}
                            </DialogTitle>
                            <DialogDescription>
                                {editingGroup
                                    ? 'Modifiez les paramètres du groupe'
                                    : 'Créez un nouveau groupe avec des permissions spécifiques'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-2">
                                <Label htmlFor="group-name">Nom du groupe *</Label>
                                <Input
                                    id="group-name"
                                    placeholder="Ex: Premium"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    data-testid="group-name-input"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="group-desc">Description</Label>
                                <Textarea
                                    id="group-desc"
                                    placeholder="Description du groupe..."
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    rows={2}
                                    data-testid="group-desc-input"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="max-torrents">Nombre max de torrents</Label>
                                <Input
                                    id="max-torrents"
                                    type="number"
                                    min={1}
                                    value={formMaxTorrents}
                                    onChange={(e) => setFormMaxTorrents(parseInt(e.target.value) || 1)}
                                    data-testid="max-torrents-input"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="max-download">Vitesse DL max (KB/s)</Label>
                                    <Input
                                        id="max-download"
                                        type="number"
                                        min={0}
                                        placeholder="0 = illimité"
                                        value={formMaxDownload}
                                        onChange={(e) => setFormMaxDownload(parseInt(e.target.value) || 0)}
                                        data-testid="max-download-input"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max-upload">Vitesse UP max (KB/s)</Label>
                                    <Input
                                        id="max-upload"
                                        type="number"
                                        min={0}
                                        placeholder="0 = illimité"
                                        value={formMaxUpload}
                                        onChange={(e) => setFormMaxUpload(parseInt(e.target.value) || 0)}
                                        data-testid="max-upload-input"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <h4 className="text-sm font-medium">Permissions</h4>
                                
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Search className="w-4 h-4 text-muted-foreground" />
                                        <Label htmlFor="can-jackett" className="font-normal">
                                            Utiliser la recherche Jackett
                                        </Label>
                                    </div>
                                    <Switch
                                        id="can-jackett"
                                        checked={formCanUseJackett}
                                        onCheckedChange={setFormCanUseJackett}
                                        data-testid="can-jackett-switch"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-muted-foreground" />
                                        <Label htmlFor="can-see-all" className="font-normal">
                                            Voir tous les torrents
                                        </Label>
                                    </div>
                                    <Switch
                                        id="can-see-all"
                                        checked={formCanSeeAll}
                                        onCheckedChange={setFormCanSeeAll}
                                        data-testid="can-see-all-switch"
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Annuler</Button>
                            </DialogClose>
                            <Button onClick={handleSubmit} data-testid="save-group-btn">
                                {editingGroup ? 'Sauvegarder' : 'Créer'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Groups Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                    <Card key={group.id} className="stat-card" data-testid={`group-card-${group.id}`}>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{group.name}</CardTitle>
                                        {group.description && (
                                            <CardDescription className="mt-0.5">
                                                {group.description}
                                            </CardDescription>
                                        )}
                                    </div>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEditDialog(group)}>
                                            <Edit className="w-4 h-4 mr-2" />
                                            Modifier
                                        </DropdownMenuItem>
                                        {group.name !== 'Défaut' && (
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(group.id, group.name)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Supprimer
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Utilisateurs</span>
                                <span className="font-medium">{group.user_count}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Max torrents</span>
                                <span className="font-medium">{group.max_torrents}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Download className="w-3 h-3" /> DL max
                                </span>
                                <span className="font-mono text-xs">{formatSpeed(group.max_download_speed)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Upload className="w-3 h-3" /> UP max
                                </span>
                                <span className="font-mono text-xs">{formatSpeed(group.max_upload_speed)}</span>
                            </div>

                            <div className="flex gap-2 pt-2">
                                {group.can_use_jackett && (
                                    <span className="status-badge status-completed text-xs">
                                        Jackett
                                    </span>
                                )}
                                {group.can_see_all_torrents && (
                                    <span className="status-badge status-downloading text-xs">
                                        Voir tout
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default AdminGroupsPage;
