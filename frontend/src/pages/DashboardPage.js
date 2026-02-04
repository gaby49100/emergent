// DashboardPage - Tableau de bord avec statistiques
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Download, Upload, HardDrive, Activity, CheckCircle, Clock } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Fonction pour formater les vitesses
const formatSpeed = (bytes) => {
    if (bytes === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Fonction pour formater la taille
const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const DashboardPage = () => {
    const [stats, setStats] = useState({
        total_torrents: 0,
        active_torrents: 0,
        completed_torrents: 0,
        total_download_speed: 0,
        total_upload_speed: 0
    });
    const [recentTorrents, setRecentTorrents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [statsRes, torrentsRes] = await Promise.all([
                axios.get(`${API}/torrents/stats`),
                axios.get(`${API}/torrents/my`)
            ]);

            setStats(statsRes.data);
            setRecentTorrents(torrentsRes.data.slice(0, 5));
        } catch (error) {
            console.error('Erreur chargement dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Polling toutes les 5 secondes
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const statCards = [
        {
            title: 'Téléchargement',
            value: formatSpeed(stats.total_download_speed),
            icon: Download,
            color: 'text-primary',
            bgColor: 'bg-primary/10'
        },
        {
            title: 'Upload',
            value: formatSpeed(stats.total_upload_speed),
            icon: Upload,
            color: 'text-[hsl(var(--success))]',
            bgColor: 'bg-[hsl(var(--success))]/10'
        },
        {
            title: 'Total Torrents',
            value: stats.total_torrents,
            icon: HardDrive,
            color: 'text-muted-foreground',
            bgColor: 'bg-muted'
        },
        {
            title: 'Actifs',
            value: stats.active_torrents,
            icon: Activity,
            color: 'text-[hsl(var(--warning))]',
            bgColor: 'bg-[hsl(var(--warning))]/10'
        },
        {
            title: 'Terminés',
            value: stats.completed_torrents,
            icon: CheckCircle,
            color: 'text-[hsl(var(--success))]',
            bgColor: 'bg-[hsl(var(--success))]/10'
        }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 spinner" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="dashboard-page">
            <div>
                <h1 className="text-3xl font-black">Tableau de bord</h1>
                <p className="text-muted-foreground mt-1">Vue d'ensemble de vos téléchargements</p>
            </div>

            {/* Stats Grid - Bento Style */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="stats-grid">
                {statCards.map((stat, index) => (
                    <Card
                        key={stat.title}
                        className="stat-card"
                        style={{ animationDelay: `${index * 50}ms` }}
                        data-testid={`stat-card-${stat.title.toLowerCase().replace(' ', '-')}`}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                                    <p className="text-lg font-bold font-mono">{stat.value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Torrents */}
            <Card data-testid="recent-torrents-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Torrents récents
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {recentTorrents.length === 0 ? (
                        <div className="empty-state">
                            <HardDrive className="empty-state-icon" />
                            <p className="text-muted-foreground">Aucun torrent pour le moment</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Ajoutez votre premier torrent depuis "Mes torrents"
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentTorrents.map((torrent) => (
                                <div
                                    key={torrent.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                                    data-testid={`recent-torrent-${torrent.id}`}
                                >
                                    <div className="flex-1 min-w-0 mr-4">
                                        <p className="font-medium truncate">{torrent.name}</p>
                                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                            <span className="font-mono">{formatSize(torrent.size || 0)}</span>
                                            <span className={`status-badge status-${torrent.status}`}>
                                                {torrent.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-32">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-mono">{torrent.progress?.toFixed(1) || 0}%</span>
                                            </div>
                                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                        torrent.progress >= 100
                                                            ? 'progress-seeding'
                                                            : 'progress-downloading'
                                                    }`}
                                                    style={{ width: `${Math.min(torrent.progress || 0, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="text-right text-xs">
                                            <div className="flex items-center gap-1 text-primary">
                                                <Download className="w-3 h-3" />
                                                <span className="font-mono">{formatSpeed(torrent.download_speed || 0)}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[hsl(var(--success))]">
                                                <Upload className="w-3 h-3" />
                                                <span className="font-mono">{formatSpeed(torrent.upload_speed || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DashboardPage;
