// JackettSearchPage - Recherche de torrents via Jackett
import { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../components/ui/select';
import { toast } from 'sonner';
import { Search, Plus, Download, Users, Clock, ExternalLink, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Formatters
const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'Inconnu';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return 'Inconnu';
    }
};

const JackettSearchPage = () => {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [addingTorrent, setAddingTorrent] = useState(null);

    const categories = [
        { value: 'all', label: 'Toutes catégories' },
        { value: '2000', label: 'Films' },
        { value: '5000', label: 'Séries TV' },
        { value: '3000', label: 'Musique' },
        { value: '1000', label: 'Applications' },
        { value: '4000', label: 'Jeux' },
        { value: '7000', label: 'Livres' }
    ];

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) {
            toast.error('Veuillez entrer un terme de recherche');
            return;
        }

        setLoading(true);
        setHasSearched(true);

        try {
            const params = { query: query.trim() };
            if (category !== 'all') {
                params.category = category;
            }

            const response = await axios.get(`${API}/jackett/search`, { params });
            setResults(response.data.results);

            if (response.data.results.length === 0) {
                toast.info('Aucun résultat trouvé');
            }
        } catch (error) {
            const message = error.response?.data?.detail || 'Erreur lors de la recherche';
            toast.error(message);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTorrent = async (result) => {
        if (!result.magnet) {
            toast.error('Pas de lien magnet disponible pour ce torrent');
            return;
        }

        setAddingTorrent(result.title);

        try {
            await axios.post(`${API}/torrents/add`, {
                name: result.title,
                magnet: result.magnet
            });
            toast.success(`"${result.title}" ajouté avec succès`);
        } catch (error) {
            const message = error.response?.data?.detail || 'Erreur lors de l\'ajout';
            toast.error(message);
        } finally {
            setAddingTorrent(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in" data-testid="jackett-search-page">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black">Recherche Jackett</h1>
                <p className="text-muted-foreground mt-1">
                    Recherchez des torrents et ajoutez-les directement à qBittorrent
                </p>
            </div>

            {/* Search Form */}
            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher un torrent..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="pl-10 search-input"
                                data-testid="jackett-search-input"
                            />
                        </div>

                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="w-full sm:w-48" data-testid="category-select">
                                <SelectValue placeholder="Catégorie" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button type="submit" disabled={loading} data-testid="search-btn">
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Recherche...
                                </>
                            ) : (
                                <>
                                    <Search className="w-4 h-4 mr-2" />
                                    Rechercher
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Results */}
            {hasSearched && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">
                            {loading
                                ? 'Recherche en cours...'
                                : `${results.length} résultat${results.length > 1 ? 's' : ''}`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {results.length === 0 && !loading ? (
                            <div className="empty-state">
                                <Search className="empty-state-icon" />
                                <h3 className="text-lg font-semibold">Aucun résultat</h3>
                                <p className="text-muted-foreground mt-1">
                                    Essayez avec d'autres termes de recherche
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {results.map((result, index) => (
                                    <div
                                        key={index}
                                        className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                                        data-testid={`search-result-${index}`}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium truncate" title={result.title}>
                                                    {result.title}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Download className="w-3 h-3" />
                                                        <span className="font-mono">{formatSize(result.size)}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[hsl(var(--success))]">
                                                        <Users className="w-3 h-3" />
                                                        {result.seeders} seeders
                                                    </span>
                                                    <span className="flex items-center gap-1 text-destructive">
                                                        <Users className="w-3 h-3" />
                                                        {result.leechers} leechers
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDate(result.published)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <ExternalLink className="w-3 h-3" />
                                                        {result.tracker}
                                                    </span>
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => handleAddTorrent(result)}
                                                disabled={addingTorrent === result.title || !result.magnet}
                                                size="sm"
                                                className="shrink-0"
                                                data-testid={`add-result-${index}`}
                                            >
                                                {addingTorrent === result.title ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        Ajout...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus className="w-4 h-4 mr-2" />
                                                        Ajouter
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Help text */}
            {!hasSearched && (
                <Card>
                    <CardContent className="py-12">
                        <div className="empty-state">
                            <Search className="empty-state-icon" />
                            <h3 className="text-lg font-semibold">Recherchez des torrents</h3>
                            <p className="text-muted-foreground mt-1 max-w-md">
                                Utilisez la barre de recherche ci-dessus pour trouver des torrents.
                                Les résultats proviennent de vos indexeurs Jackett configurés.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default JackettSearchPage;
