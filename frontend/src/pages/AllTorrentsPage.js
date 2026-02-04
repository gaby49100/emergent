// AllTorrentsPage - Page affichant tous les torrents de tous les utilisateurs
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Download, Upload, Users, Search, RefreshCw, HardDrive } from 'lucide-react';

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

const getStatusLabel = (status) => {
    const statusMap = {
        'downloading': 'Téléchargement',
        'uploading': 'Partage',
        'stalledDL': 'En attente',
        'stalledUP': 'En attente',
        'pausedDL': 'En pause',
        'pausedUP': 'En pause',
        'completed': 'Terminé',
        'error': 'Erreur',
        'unknown': 'Inconnu'
    };
    return statusMap[status] || status;
};

const AllTorrentsPage = () => {
    const [torrents, setTorrents] = useState([]);
    const [filteredTorrents, setFilteredTorrents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchTorrents = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/torrents/all`);
            setTorrents(response.data);
            setFilteredTorrents(response.data);
        } catch (error) {
            console.error('Erreur chargement torrents:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTorrents();
        const interval = setInterval(fetchTorrents, 5000);
        return () => clearInterval(interval);
    }, [fetchTorrents]);

    useEffect(() => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            setFilteredTorrents(
                torrents.filter(
                    (t) =>
                        t.name.toLowerCase().includes(query) ||
                        t.username.toLowerCase().includes(query)
                )
            );
        } else {
            setFilteredTorrents(torrents);
        }
    }, [searchQuery, torrents]);

    // Group by user
    const userStats = torrents.reduce((acc, torrent) => {
        if (!acc[torrent.username]) {
            acc[torrent.username] = { count: 0, downloading: 0, completed: 0 };
        }
        acc[torrent.username].count++;
        if (torrent.progress >= 100) {
            acc[torrent.username].completed++;
        } else {
            acc[torrent.username].downloading++;
        }
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 spinner" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="all-torrents-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black">Tous les torrents</h1>
                    <p className="text-muted-foreground mt-1">
                        Vue d'ensemble des téléchargements de tous les utilisateurs
                    </p>
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={fetchTorrents}
                    data-testid="refresh-all-btn"
                >
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>

            {/* User Stats */}
            {Object.keys(userStats).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(userStats).map(([username, stats]) => (
                        <Card key={username} className="stat-card" data-testid={`user-stat-${username}`}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium truncate">{username}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {stats.count} torrent{stats.count > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Rechercher par nom ou utilisateur..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 search-input"
                    data-testid="search-all-input"
                />
            </div>

            {/* Torrents List */}
            {filteredTorrents.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="empty-state">
                            <HardDrive className="empty-state-icon" />
                            <h3 className="text-lg font-semibold">
                                {searchQuery ? 'Aucun résultat' : 'Aucun torrent'}
                            </h3>
                            <p className="text-muted-foreground mt-1">
                                {searchQuery
                                    ? 'Essayez avec d\'autres termes de recherche'
                                    : 'Aucun torrent n\'a été ajouté pour le moment'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">
                            {filteredTorrents.length} torrent{filteredTorrents.length > 1 ? 's' : ''}
                            {searchQuery && ` trouvé${filteredTorrents.length > 1 ? 's' : ''}`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="torrent-table" data-testid="all-torrents-table">
                                <thead>
                                    <tr>
                                        <th>Nom</th>
                                        <th>Utilisateur</th>
                                        <th>Taille</th>
                                        <th>Progression</th>
                                        <th>État</th>
                                        <th>Vitesse</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTorrents.map((torrent) => (
                                        <tr key={torrent.id} data-testid={`all-torrent-row-${torrent.id}`}>
                                            <td>
                                                <div className="max-w-xs truncate font-medium">
                                                    {torrent.name}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="text-sm text-muted-foreground">
                                                    {torrent.username}
                                                </span>
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

export default AllTorrentsPage;
