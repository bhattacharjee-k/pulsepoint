import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import { copy } from '../copy';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ErrorState } from '../components/ErrorState';

export function Login({ onLogin }: { onLogin: (role: 'admin' | 'member', email: string) => void }) {
  const [email, setEmail] = useState('admin@alpha.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api.login(email, password);
      onLogin(result.user.role, result.user.email);
    } catch {
      setError(copy.login.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <h1 className="text-display text-foreground">{copy.login.title}</h1>
          <p className="mx-auto mt-2 max-w-xs text-body text-muted-foreground">{copy.login.tagline}</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{copy.login.emailLabel}</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{copy.login.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <ErrorState message={error} />}
            <Button type="submit" className="w-full" disabled={busy}>
              {copy.login.submit}
            </Button>
          </form>
        </Card>
      </motion.div>
    </main>
  );
}
