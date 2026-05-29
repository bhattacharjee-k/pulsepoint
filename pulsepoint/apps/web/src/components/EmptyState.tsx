import type { ReactNode } from 'react';
import { motion } from 'motion/react';

/** Soft fade-up empty state (brand-ui.md motion: "Empty state — soft fade up"). */
export function EmptyState({
  icon,
  headline,
  body,
  action
}: {
  icon?: ReactNode;
  headline: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center"
    >
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <h3 className="text-h3 text-foreground">{headline}</h3>
      <p className="max-w-sm text-body text-muted-foreground">{body}</p>
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}
