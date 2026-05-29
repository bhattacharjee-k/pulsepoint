import { Inbox as InboxIcon, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { copy } from '../copy';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

export type View = 'inbox' | 'settings';

export function Sidebar({
  email,
  role,
  view,
  onView,
  onSignOut
}: {
  email: string;
  role: 'admin' | 'member';
  view: View;
  onView: (view: View) => void;
  onSignOut: () => void;
}) {
  const itemClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-body transition-colors',
      active ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
    );

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-elevated p-4">
      <div className="mb-6 flex items-center gap-2 px-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
        <span className="text-h3 font-semibold text-foreground">PulsePoint</span>
      </div>

      <button type="button" className={itemClass(view === 'inbox')} onClick={() => onView('inbox')}>
        <InboxIcon className="h-4 w-4" />
        {copy.nav.inbox}
      </button>

      {role === 'admin' && (
        <button type="button" className={itemClass(view === 'settings')} onClick={() => onView('settings')}>
          <SettingsIcon className="h-4 w-4" />
          {copy.nav.settings}
        </button>
      )}

      <div className="mt-auto space-y-2 pt-4">
        <p className="truncate px-3 text-caption text-muted-foreground" title={email}>
          {email}
        </p>
        <Button variant="ghost" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          {copy.nav.signOut}
        </Button>
      </div>
    </aside>
  );
}
