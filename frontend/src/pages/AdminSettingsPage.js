// AdminSettingsPage - Configuration qBittorrent, Jackett et Téléchargements
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Settings, Server, Search, CheckCircle, XCircle, Loader2, RefreshCw, Download, Copy, FileCode } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminSettingsPage = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState({ qbit: false, jackett: false });

    // qBittorrent settings
    const [qbitHost, setQbitHost] = useState('');
    const [qbitPort, setQbitPort] = useState(8080);
    const [qbitUsername, setQbitUsername] = useState('');
    const [qbitPassword, setQbitPassword] = useState('');
    const [qbitHttps, setQbitHttps] = useState(false);
    const [qbitStatus, setQbitStatus] = useState('not_configured');

    // Jackett settings
    const [jackettUrl, setJackettUrl] = useState('');
    const [jackettApiKey, setJackettApiKey] = useState('');
    const [jackettStatus, setJackettStatus] = useState('not_configured');

    // Download settings
    const [downloadBaseUrl, setDownloadBaseUrl] = useState('');
    const [downloadSecretKey, setDownloadSecretKey] = useState('');
    const [downloadPath, setDownloadPath] = useState('/downloads');
    const [downloadExpiry, setDownloadExpiry] = useState(1);
    const [downloadConfigured, setDownloadConfigured] = useState(false);
    const [nginxConfig, setNginxConfig] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const [settingsRes, downloadRes] = await Promise.all([
                axios.get(`${API}/admin/settings`),
                axios.get(`${API}/admin/settings/download`).catch(() => ({ data: { configured: false } }))
            ]);

            const data = settingsRes.data;

            if (data.qbittorrent) {
                setQbitHost(data.qbittorrent.host || '');
                setQbitPort(data.qbittorrent.port || 8080);
                setQbitUsername(data.qbittorrent.username || '');
                setQbitHttps(data.qbittorrent.use_https || false);
            }
            if (data.jackett) {
                setJackettUrl(data.jackett.url || '');
            }

            setQbitStatus(data.qbittorrent_status);
            setJackettStatus(data.jackett_status);

            // Download settings
            if (downloadRes.data.configured) {
                setDownloadBaseUrl(downloadRes.data.base_url || '');
                setDownloadPath(downloadRes.data.download_path || '/downloads');
                setDownloadExpiry(downloadRes.data.link_expiry_hours || 1);
                setDownloadConfigured(true);
            }
        } catch (error) {
            console.error('Erreur chargement paramètres:', error);
            toast.error('Erreur lors du chargement des paramètres');
        } finally {
            setLoading(false);
        }
    };

    const saveQbitSettings = async () => {
        if (!qbitHost || !qbitUsername || !qbitPassword) {
            toast.error('Veuillez remplir tous les champs qBittorrent');
            return;
        }

        setSaving(true);
        try {
            const response = await axios.post(`${API}/admin/settings/qbittorrent`, {
                host: qbitHost,
                port: qbitPort,
                username: qbitUsername,
                password: qbitPassword,
                use_https: qbitHttps
            });

            if (response.data.status === 'connected') {
                toast.success(response.data.message);
                setQbitStatus('configured');
            } else {
                toast.warning(response.data.message);
            }
        } catch (error) {
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const saveJackettSettings = async () => {
        if (!jackettUrl || !jackettApiKey) {
            toast.error('Veuillez remplir tous les champs Jackett');
            return;
        }

        setSaving(true);
        try {
            const response = await axios.post(`${API}/admin/settings/jackett`, {
                url: jackettUrl,
                api_key: jackettApiKey
            });

            if (response.data.status === 'connected') {
                toast.success(response.data.message);
                setJackettStatus('configured');
            } else {
                toast.warning(response.data.message);
            }
        } catch (error) {
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const saveDownloadSettings = async () => {
        if (!downloadBaseUrl || !downloadSecretKey) {
            toast.error('Veuillez remplir l\'URL de base et la clé secrète');
            return;
        }

        if (downloadSecretKey.length < 16) {
            toast.error('La clé secrète doit contenir au moins 16 caractères');
            return;
        }

        setSaving(true);
        try {
            await axios.post(`${API}/admin/settings/download`, {
                base_url: downloadBaseUrl,
                secret_key: downloadSecretKey,
                download_path: downloadPath,
                link_expiry_hours: downloadExpiry
            });

            toast.success('Paramètres de téléchargement sauvegardés');
            setDownloadConfigured(true);

            // Récupérer la config nginx
            const nginxRes = await axios.get(`${API}/admin/settings/nginx-config`);
            if (nginxRes.data.config) {
                setNginxConfig(nginxRes.data.config);
            }
        } catch (error) {
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const generateSecretKey = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let key = '';
        for (let i = 0; i < 32; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setDownloadSecretKey(key);
        toast.success('Clé secrète générée');
    };

    const testQbitConnection = async () => {
        setTesting(prev => ({ ...prev, qbit: true }));
        try {
            const response = await axios.post(`${API}/admin/settings/test-qbittorrent`);
            if (response.data.status === 'connected') {
                toast.success(`Connexion réussie ! Version: ${response.data.version}`);
                setQbitStatus('configured');
            } else {
                toast.error(response.data.message || 'Échec de connexion');
            }
        } catch (error) {
            toast.error('Erreur lors du test');
        } finally {
            setTesting(prev => ({ ...prev, qbit: false }));
        }
    };

    const testJackettConnection = async () => {
        setTesting(prev => ({ ...prev, jackett: true }));
        try {
            const response = await axios.post(`${API}/admin/settings/test-jackett`);
            if (response.data.status === 'connected') {
                toast.success('Connexion Jackett réussie !');
                setJackettStatus('configured');
            } else {
                toast.error(response.data.message || 'Échec de connexion');
            }
        } catch (error) {
            toast.error('Erreur lors du test');
        } finally {
            setTesting(prev => ({ ...prev, jackett: false }));
        }
    };

    const copyNginxConfig = () => {
        navigator.clipboard.writeText(nginxConfig);
        toast.success('Configuration copiée !');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 spinner" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="admin-settings-page">
            <div>
                <h1 className="text-3xl font-black">Paramètres</h1>
                <p className="text-muted-foreground mt-1">Configuration des services externes</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* qBittorrent Settings */}
                <Card data-testid="qbit-settings-card">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Server className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle>qBittorrent</CardTitle>
                                    <CardDescription>Configuration du client torrent</CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {qbitStatus === 'configured' ? (
                                    <span className="flex items-center gap-1 text-sm text-[hsl(var(--success))]">
                                        <CheckCircle className="w-4 h-4" />
                                        Connecté
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <XCircle className="w-4 h-4" />
                                        Non configuré
                                    </span>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="qbit-host">Hôte</Label>
                                <Input
                                    id="qbit-host"
                                    placeholder="qbt.example.com"
                                    value={qbitHost}
                                    onChange={(e) => setQbitHost(e.target.value)}
                                    data-testid="qbit-host-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="qbit-port">Port</Label>
                                <Input
                                    id="qbit-port"
                                    type="number"
                                    placeholder="443"
                                    value={qbitPort}
                                    onChange={(e) => setQbitPort(parseInt(e.target.value) || 8080)}
                                    data-testid="qbit-port-input"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="qbit-username">Nom d'utilisateur</Label>
                                <Input
                                    id="qbit-username"
                                    placeholder="admin"
                                    value={qbitUsername}
                                    onChange={(e) => setQbitUsername(e.target.value)}
                                    data-testid="qbit-username-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="qbit-password">Mot de passe</Label>
                                <Input
                                    id="qbit-password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={qbitPassword}
                                    onChange={(e) => setQbitPassword(e.target.value)}
                                    data-testid="qbit-password-input"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="qbit-https"
                                    checked={qbitHttps}
                                    onCheckedChange={setQbitHttps}
                                    data-testid="qbit-https-switch"
                                />
                                <Label htmlFor="qbit-https">Utiliser HTTPS</Label>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button onClick={saveQbitSettings} disabled={saving} data-testid="save-qbit-btn">
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
                                Sauvegarder
                            </Button>
                            <Button variant="outline" onClick={testQbitConnection} disabled={testing.qbit} data-testid="test-qbit-btn">
                                {testing.qbit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Tester
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Jackett Settings */}
                <Card data-testid="jackett-settings-card">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[hsl(var(--success))]/10">
                                    <Search className="w-5 h-5 text-[hsl(var(--success))]" />
                                </div>
                                <div>
                                    <CardTitle>Jackett</CardTitle>
                                    <CardDescription>Configuration du service de recherche</CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {jackettStatus === 'configured' ? (
                                    <span className="flex items-center gap-1 text-sm text-[hsl(var(--success))]">
                                        <CheckCircle className="w-4 h-4" />
                                        Connecté
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <XCircle className="w-4 h-4" />
                                        Non configuré
                                    </span>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="jackett-url">URL Jackett</Label>
                            <Input
                                id="jackett-url"
                                placeholder="https://jackett.example.com"
                                value={jackettUrl}
                                onChange={(e) => setJackettUrl(e.target.value)}
                                data-testid="jackett-url-input"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="jackett-api">Clé API</Label>
                            <Input
                                id="jackett-api"
                                type="password"
                                placeholder="Votre clé API Jackett"
                                value={jackettApiKey}
                                onChange={(e) => setJackettApiKey(e.target.value)}
                                data-testid="jackett-api-input"
                            />
                            <p className="text-xs text-muted-foreground">
                                Trouvez votre clé API dans l'interface web Jackett, en haut à droite
                            </p>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button onClick={saveJackettSettings} disabled={saving} data-testid="save-jackett-btn">
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
                                Sauvegarder
                            </Button>
                            <Button variant="outline" onClick={testJackettConnection} disabled={testing.jackett} data-testid="test-jackett-btn">
                                {testing.jackett ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Tester
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Download Settings */}
            <Card data-testid="download-settings-card">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[hsl(var(--warning))]/10">
                                <Download className="w-5 h-5 text-[hsl(var(--warning))]" />
                            </div>
                            <div>
                                <CardTitle>Téléchargements sécurisés</CardTitle>
                                <CardDescription>Configuration des URLs signées avec expiration</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {downloadConfigured ? (
                                <span className="flex items-center gap-1 text-sm text-[hsl(var(--success))]">
                                    <CheckCircle className="w-4 h-4" />
                                    Configuré
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <XCircle className="w-4 h-4" />
                                    Non configuré
                                </span>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="download-url">URL de base des fichiers</Label>
                            <Input
                                id="download-url"
                                placeholder="https://files.example.com"
                                value={downloadBaseUrl}
                                onChange={(e) => setDownloadBaseUrl(e.target.value)}
                                data-testid="download-url-input"
                            />
                            <p className="text-xs text-muted-foreground">
                                L'URL de votre serveur nginx qui servira les fichiers
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="download-path">Chemin des téléchargements</Label>
                            <Input
                                id="download-path"
                                placeholder="/downloads"
                                value={downloadPath}
                                onChange={(e) => setDownloadPath(e.target.value)}
                                data-testid="download-path-input"
                            />
                            <p className="text-xs text-muted-foreground">
                                Chemin vers le dossier qBittorrent sur votre serveur
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="download-secret">Clé secrète partagée</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="download-secret"
                                    type="password"
                                    placeholder="Minimum 16 caractères"
                                    value={downloadSecretKey}
                                    onChange={(e) => setDownloadSecretKey(e.target.value)}
                                    data-testid="download-secret-input"
                                />
                                <Button variant="outline" size="icon" onClick={generateSecretKey} title="Générer une clé">
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Cette clé doit être identique dans nginx
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="download-expiry">Durée de validité (heures)</Label>
                            <Input
                                id="download-expiry"
                                type="number"
                                min={1}
                                max={24}
                                value={downloadExpiry}
                                onChange={(e) => setDownloadExpiry(parseInt(e.target.value) || 1)}
                                data-testid="download-expiry-input"
                            />
                            <p className="text-xs text-muted-foreground">
                                Les liens expireront après cette durée
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <Button onClick={saveDownloadSettings} disabled={saving} data-testid="save-download-btn">
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
                            Sauvegarder
                        </Button>

                        {downloadConfigured && nginxConfig && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" data-testid="show-nginx-btn">
                                        <FileCode className="w-4 h-4 mr-2" />
                                        Config Nginx
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>Configuration Nginx</DialogTitle>
                                        <DialogDescription>
                                            Ajoutez cette configuration à votre serveur nginx pour activer les téléchargements sécurisés
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="relative">
                                        <Textarea
                                            value={nginxConfig}
                                            readOnly
                                            rows={20}
                                            className="font-mono text-xs"
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="absolute top-2 right-2"
                                            onClick={copyNginxConfig}
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminSettingsPage;
