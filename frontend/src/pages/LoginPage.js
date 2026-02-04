// LoginPage - Page de connexion et inscription
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Download, Lock, Mail, User } from 'lucide-react';

const LoginPage = () => {
    const navigate = useNavigate();
    const { login, register } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    // Login form state
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register form state
    const [registerUsername, setRegisterUsername] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await login(loginEmail, loginPassword);
            toast.success('Connexion réussie !');
            navigate('/dashboard');
        } catch (error) {
            const message = error.response?.data?.detail || 'Erreur de connexion';
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (registerPassword !== registerConfirmPassword) {
            toast.error('Les mots de passe ne correspondent pas');
            return;
        }

        if (registerPassword.length < 6) {
            toast.error('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        setIsLoading(true);

        try {
            await register(registerUsername, registerEmail, registerPassword);
            toast.success('Compte créé avec succès !');
            navigate('/dashboard');
        } catch (error) {
            const message = error.response?.data?.detail || 'Erreur lors de l\'inscription';
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 mb-4">
                        <Download className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">QBitMaster</h1>
                    <p className="text-muted-foreground mt-2">Gestion de torrents multi-utilisateurs</p>
                </div>

                <Card className="glass animate-slide-up" data-testid="auth-card">
                    <Tabs defaultValue="login" className="w-full">
                        <TabsList className="grid w-full grid-cols-2" data-testid="auth-tabs">
                            <TabsTrigger value="login" data-testid="login-tab">Connexion</TabsTrigger>
                            <TabsTrigger value="register" data-testid="register-tab">Inscription</TabsTrigger>
                        </TabsList>

                        {/* Login Tab */}
                        <TabsContent value="login">
                            <CardHeader>
                                <CardTitle>Connexion</CardTitle>
                                <CardDescription>
                                    Connectez-vous à votre compte pour gérer vos torrents
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="login-email">Email</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                id="login-email"
                                                type="email"
                                                placeholder="votre@email.com"
                                                value={loginEmail}
                                                onChange={(e) => setLoginEmail(e.target.value)}
                                                className="pl-10"
                                                required
                                                data-testid="login-email-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="login-password">Mot de passe</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                id="login-password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={loginPassword}
                                                onChange={(e) => setLoginPassword(e.target.value)}
                                                className="pl-10"
                                                required
                                                data-testid="login-password-input"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full btn-action"
                                        disabled={isLoading}
                                        data-testid="login-submit-btn"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 spinner" />
                                                Connexion...
                                            </span>
                                        ) : (
                                            'Se connecter'
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </TabsContent>

                        {/* Register Tab */}
                        <TabsContent value="register">
                            <CardHeader>
                                <CardTitle>Inscription</CardTitle>
                                <CardDescription>
                                    Créez un compte pour commencer à utiliser QBitMaster
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleRegister} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="register-username">Nom d'utilisateur</Label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                id="register-username"
                                                type="text"
                                                placeholder="johndoe"
                                                value={registerUsername}
                                                onChange={(e) => setRegisterUsername(e.target.value)}
                                                className="pl-10"
                                                required
                                                minLength={3}
                                                data-testid="register-username-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="register-email">Email</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                id="register-email"
                                                type="email"
                                                placeholder="votre@email.com"
                                                value={registerEmail}
                                                onChange={(e) => setRegisterEmail(e.target.value)}
                                                className="pl-10"
                                                required
                                                data-testid="register-email-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="register-password">Mot de passe</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                id="register-password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={registerPassword}
                                                onChange={(e) => setRegisterPassword(e.target.value)}
                                                className="pl-10"
                                                required
                                                minLength={6}
                                                data-testid="register-password-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="register-confirm">Confirmer le mot de passe</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                id="register-confirm"
                                                type="password"
                                                placeholder="••••••••"
                                                value={registerConfirmPassword}
                                                onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                                                className="pl-10"
                                                required
                                                data-testid="register-confirm-input"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full btn-action"
                                        disabled={isLoading}
                                        data-testid="register-submit-btn"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 spinner" />
                                                Création...
                                            </span>
                                        ) : (
                                            'Créer un compte'
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </TabsContent>
                    </Tabs>
                </Card>

                <p className="text-center text-xs text-muted-foreground mt-6">
                    En vous connectant, vous acceptez nos conditions d'utilisation
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
