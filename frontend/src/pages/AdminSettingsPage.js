// AdminSettingsPage - Configuration qBittorrent et Jackett
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Settings, Server, Search, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

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

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await axios.get(`${API}/admin/settings`);
            const data = response.data;

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
                                    placeholder="192.168.1.100"
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
                                    placeholder="8080"
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
                                placeholder="http://192.168.1.100:9117"
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
        </div>
    );
};

export default AdminSettingsPage;
