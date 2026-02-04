// MyTorrentsPage - Page de gestion des torrents de l'utilisateur
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
    Plus,
    Download,
    Upload,
    Pause,
    Play,
    Trash2,
    MoreVertical,
    Link,
    FileUp,
    HardDrive,
    RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Formatters
const formatSpeed = (bytes) => {
    if (bytes === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatEta = (seconds) => {
    if (seconds <= 0 || seconds === 8640000) return '∞';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}j`;
};

const getStatusLabel = (status) => {
    const statusMap = {
        'downloading': 'Téléchargement',
        'uploading': 'Partage',
        'stalledDL': 'En attente (DL)',
        'stalledUP': 'En attente (UP)',
        'pausedDL': 'En pause',
        'pausedUP': 'En pause',
        'queuedDL': 'En file',
        'queuedUP': 'En file',
        'checkingDL': 'Vérification',
        'checkingUP': 'Vérification',
        'completed': 'Terminé',
        'error': 'Erreur',
        'missingFiles': 'Fichiers manquants',
        'unknown': 'Inconnu'
    };
    return statusMap[status] || status;
};

const MyTorrentsPage = () => {
    const [torrents, setTorrents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addType, setAddType] = useState('magnet');
    const [magnetLink, setMagnetLink] = useState('');
    const [torrentName, setTorrentName] = useState('');
    const [torrentFile, setTorrentFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchTorrents = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/torrents/my`);
            setTorrents(response.data);
        } catch (error) {
            console.error('Erreur chargement torrents:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTorrents();
        const interval = setInterval(fetchTorrents, 3000);
        return () => clearInterval(interval);
    }, [fetchTorrents]);

    const handleAddMagnet = async (e) => {
        e.preventDefault();
        if (!magnetLink.trim()) {
            toast.error('Veuillez entrer un lien magnet');
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.post(`${API}/torrents/add`, {
                name: torrentName || 'Torrent sans nom',
                magnet: magnetLink
            });
            toast.success('Torrent ajouté avec succès');
            setMagnetLink('');
            setTorrentName('');
            setAddDialogOpen(false);
            fetchTorrents();
        } catch (error) {
            const message = error.response?.data?.detail || 'Erreur lors de l\'ajout';
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddFile = async (e) => {
        e.preventDefault();
        if (!torrentFile) {
            toast.error('Veuillez sélectionner un fichier');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('file', torrentFile);
            formData.append('name', torrentName || torrentFile.name.replace('.torrent', ''));

            await axios.post(`${API}/torrents/add-file`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Fichier torrent ajouté avec succès');
            setTorrentFile(null);
            setTorrentName('');
            setAddDialogOpen(false);
            fetchTorrents();
        } catch (error) {
            const message = error.response?.data?.detail || 'Erreur lors de l\'ajout';
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePause = async (torrentId) => {
        try {
            await axios.post(`${API}/torrents/${torrentId}/pause`);
            toast.success('Torrent mis en pause');
            fetchTorrents();
        } catch (error) {
            toast.error('Erreur lors de la mise en pause');
        }
    };

    const handleResume = async (torrentId) => {
        try {
            await axios.post(`${API}/torrents/${torrentId}/resume`);
            toast.success('Torrent repris');
            fetchTorrents();
        } catch (error) {
            toast.error('Erreur lors de la reprise');
        }
    };

    const handleDelete = async (torrentId) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce torrent ?')) return;

        try {
            await axios.delete(`${API}/torrents/${torrentId}`);
            toast.success('Torrent supprimé');
            fetchTorrents();
        } catch (error) {
            toast.error('Erreur lors de la suppression');
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
        <div className="space-y-6 animate-fade-in" data-testid="my-torrents-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black">Mes torrents</h1>
                    <p className="text-muted-foreground mt-1">Gérez vos téléchargements</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchTorrents}
                        data-testid="refresh-btn"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>

                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="add-torrent-btn">
                                <Plus className="w-4 h-4 mr-2" />
                                Ajouter un torrent
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md" data-testid="add-torrent-dialog">
                            <DialogHeader>
                                <DialogTitle>Ajouter un torrent</DialogTitle>
                                <DialogDescription>
                                    Ajoutez un torrent via lien magnet ou fichier .torrent
                                </DialogDescription>
                            </DialogHeader>

                            {/* Type selector */}
                            <div className="flex gap-2 mb-4">
                                <Button
                                    variant={addType === 'magnet' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setAddType('magnet')}
                                    data-testid="add-type-magnet"
                                >
                                    <Link className="w-4 h-4 mr-2" />
                                    Lien Magnet
                                </Button>
                                <Button
                                    variant={addType === 'file' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setAddType('file')}
                                    data-testid="add-type-file"
                                >
                                    <FileUp className="w-4 h-4 mr-2" />
                                    Fichier .torrent
                                </Button>
                            </div>

                            {addType === 'magnet' ? (
                                <form onSubmit={handleAddMagnet} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="torrent-name">Nom (optionnel)</Label>
                                        <Input
                                            id="torrent-name"
                                            placeholder="Mon super torrent"
                                            value={torrentName}
                                            onChange={(e) => setTorrentName(e.target.value)}
                                            data-testid="torrent-name-input"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="magnet-link">Lien Magnet</Label>
                                        <Input
                                            id="magnet-link"
                                            placeholder="magnet:?xt=urn:btih:..."
                                            value={magnetLink}
                                            onChange={(e) => setMagnetLink(e.target.value)}
                                            required
                                            data-testid="magnet-link-input"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button type="button" variant="outline">Annuler</Button>
                                        </DialogClose>
                                        <Button type="submit" disabled={isSubmitting} data-testid="submit-magnet-btn">
                                            {isSubmitting ? 'Ajout...' : 'Ajouter'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            ) : (
                                <form onSubmit={handleAddFile} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="torrent-name-file">Nom (optionnel)</Label>
                                        <Input
                                            id="torrent-name-file"
                                            placeholder="Mon super torrent"
                                            value={torrentName}
                                            onChange={(e) => setTorrentName(e.target.value)}
                                            data-testid="torrent-name-file-input"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="torrent-file">Fichier .torrent</Label>
                                        <Input
                                            id="torrent-file"
                                            type="file"
                                            accept=".torrent"
                                            onChange={(e) => setTorrentFile(e.target.files?.[0] || null)}
                                            required
                                            data-testid="torrent-file-input"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button type="button" variant="outline">Annuler</Button>
                                        </DialogClose>
                                        <Button type="submit" disabled={isSubmitting} data-testid="submit-file-btn">
                                            {isSubmitting ? 'Ajout...' : 'Ajouter'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Torrents List */}
            {torrents.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="empty-state">
                            <HardDrive className="empty-state-icon" />
                            <h3 className="text-lg font-semibold">Aucun torrent</h3>
                            <p className="text-muted-foreground mt-1">
                                Ajoutez votre premier torrent pour commencer
                            </p>
                            <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Ajouter un torrent
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">
                            {torrents.length} torrent{torrents.length > 1 ? 's' : ''}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="torrent-table" data-testid="torrents-table">
                                <thead>
                                    <tr>
                                        <th>Nom</th>
                                        <th>Taille</th>
                                        <th>Progression</th>
                                        <th>État</th>
                                        <th>Vitesse</th>
                                        <th>ETA</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {torrents.map((torrent) => (
                                        <tr key={torrent.id} data-testid={`torrent-row-${torrent.id}`}>
                                            <td>
                                                <div className="max-w-xs truncate font-medium">
                                                    {torrent.name}
                                                </div>
                                            </td>
                                            <td className="font-mono text-sm">
                                                {formatSize(torrent.size || 0)}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2 min-w-[120px]">
                                                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                torrent.progress >= 100
                                                                    ? 'progress-seeding'
                                                                    : torrent.status?.includes('paused')
                                                                    ? 'progress-paused'
                                                                    : 'progress-downloading'
                                                            }`}
                                                            style={{ width: `${Math.min(torrent.progress || 0, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-mono text-xs w-12 text-right">
                                                        {(torrent.progress || 0).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge status-${torrent.status?.includes('paused') ? 'paused' : torrent.progress >= 100 ? 'completed' : 'downloading'}`}>
                                                    {getStatusLabel(torrent.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="text-xs space-y-0.5">
                                                    <div className="flex items-center gap-1 text-primary">
                                                        <Download className="w-3 h-3" />
                                                        <span className="font-mono">{formatSpeed(torrent.download_speed || 0)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[hsl(var(--success))]">
                                                        <Upload className="w-3 h-3" />
                                                        <span className="font-mono">{formatSpeed(torrent.upload_speed || 0)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="font-mono text-sm">
                                                {formatEta(torrent.eta || 0)}
                                            </td>
                                            <td>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`torrent-menu-${torrent.id}`}>
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {torrent.status?.includes('paused') ? (
                                                            <DropdownMenuItem onClick={() => handleResume(torrent.id)} data-testid={`resume-${torrent.id}`}>
                                                                <Play className="w-4 h-4 mr-2" />
                                                                Reprendre
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem onClick={() => handlePause(torrent.id)} data-testid={`pause-${torrent.id}`}>
                                                                <Pause className="w-4 h-4 mr-2" />
                                                                Pause
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(torrent.id)}
                                                            className="text-destructive"
                                                            data-testid={`delete-${torrent.id}`}
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
            )}
        </div>
    );
};

export default MyTorrentsPage;
