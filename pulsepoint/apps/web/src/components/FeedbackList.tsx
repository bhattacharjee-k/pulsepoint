import { motion } from 'motion/react';
import type { FeedbackItem } from '../api';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';

export function FeedbackList({
  items,
  selectedId,
  onSelect
}: {
  items: FeedbackItem[];
  selectedId?: string;
  onSelect: (item: FeedbackItem) => void;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.2 }}
        >
          <button
            type="button"
            onClick={() => onSelect(item)}
            aria-pressed={selectedId === item.id}
            className={cn(
              'w-full rounded-md border bg-card p-3 text-left transition-colors hover:border-primary/60',
              selectedId === item.id ? 'border-primary' : 'border-border'
            )}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant={item.type}>{item.type}</Badge>
              <Badge variant={item.status}>{item.status.replace('_', ' ')}</Badge>
            </div>
            <p className="truncate text-body text-foreground">
              {item.message ?? (item.rating ? `Rating: ${item.rating}/5` : '—')}
            </p>
            <p className="mt-1 truncate text-caption text-muted-foreground">
              {item.submitterDisplayName ?? item.submitterEmail ?? 'Anonymous visitor'}
            </p>
          </button>
        </motion.li>
      ))}
    </ul>
  );
}
