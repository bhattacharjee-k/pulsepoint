import { useState } from 'react';
import { api } from './api';
import { copy } from './copy';
import { Sidebar, type View } from './components/Sidebar';
import { Login } from './pages/Login';
import { Inbox } from './pages/Inbox';
import { Settings } from './pages/Settings';

type Session = { role: 'admin' | 'member'; email: string };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('inbox');

  if (!session) {
    return (
      <Login
        onLogin={(role, email) => {
          setSession({ role, email });
          setView('inbox');
        }}
      />
    );
  }

  async function signOut() {
    try {
      await api.logout();
    } catch {
      /* even if the network call fails, drop the local session */
    }
    setSession(null);
    setView('inbox');
  }

  const isAdmin = session.role === 'admin';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar email={session.email} role={session.role} view={view} onView={setView} onSignOut={signOut} />
      <main className="min-w-0 flex-1 overflow-hidden">
        {view === 'settings' ? (
          isAdmin ? (
            <Settings email={session.email} />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-body text-muted-foreground">
              {copy.member.settingsBlocked}
            </div>
          )
        ) : (
          <Inbox canOpenSettings={isAdmin} onOpenSettings={() => setView('settings')} />
        )}
      </main>
    </div>
  );
}
