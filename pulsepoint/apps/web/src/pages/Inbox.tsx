import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Inbox as InboxIcon } from 'lucide-react';
import { api, type FeedbackItem } from '../api';
import { copy } from '../copy';
import { Button } from '../components/ui/button';
import { StatsStrip } from '../components/StatsStrip';
import { Filters } from '../components/Filters';
import { FeedbackList } from '../components/FeedbackList';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { Detail } from './Detail';

export function Inbox({
  canOpenSettings,
  onOpenSettings
}: {
  canOpenSettings: boolean;
  onOpenSettings: () => void;
}) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasFilters = Boolean(status || type || q);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (q) params.set('q', q);
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [status, type, q]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .listFeedback(query)
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setSelected((prev) => data.items.find((i) => i.id === prev?.id) ?? data.items[0] ?? null);
      })
      .catch(() => active && setError(copy.inbox.error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!items.length) return;
      const index = selected ? items.findIndex((i) => i.id === selected.id) : -1;
      if (event.key === 'j') setSelected(items[Math.min(index + 1, items.length - 1)] ?? null);
      if (event.key === 'k') setSelected(items[Math.max(index - 1, 0)] ?? null);
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, selected]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col gap-5 p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-h1 text-foreground">{copy.inbox.title}</h1>
        <p className="hidden text-caption text-muted-foreground sm:block">{copy.inbox.keyboardHint}</p>
      </div>

      <StatsStrip />
      <Filters status={status} type={type} q={q} onStatus={setStatus} onType={setType} onQ={setQ} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <div className="min-h-0 overflow-y-auto scrollbar-thin pr-1">
          {loading ? (
            <LoadingState label={copy.inbox.loading} />
          ) : error ? (
            <ErrorState message={error} />
          ) : items.length === 0 ? (
            hasFilters ? (
              <EmptyState headline={copy.inbox.filteredHeadline} body={copy.inbox.filteredBody} />
            ) : (
              <EmptyState
                icon={<InboxIcon className="h-8 w-8" />}
                headline={copy.inbox.emptyHeadline}
                body={copy.inbox.emptyBody}
                action={
                  canOpenSettings ? (
                    <Button variant="outline" size="sm" onClick={onOpenSettings}>
                      {copy.inbox.emptyCta}
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : (
            <FeedbackList items={items} selectedId={selected?.id} onSelect={setSelected} />
          )}
        </div>

        <Detail
          item={selected}
          onStatusChange={(next) => {
            if (!selected) return;
            setItems((prev) => prev.map((i) => (i.id === selected.id ? { ...i, status: next } : i)));
            setSelected((prev) => (prev ? { ...prev, status: next } : prev));
          }}
        />
      </div>
    </motion.div>
  );
}
