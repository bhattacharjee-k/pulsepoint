import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import { copy } from '../copy';
import { Card } from './ui/card';

type Stats = Awaited<ReturnType<typeof api.stats>>;

export function StatsStrip() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .stats()
      .then((s) => active && setStats(s))
      .catch(() => active && setStats(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-3" aria-label={copy.stats.loading}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[66px] w-36 animate-pulse rounded-lg border border-border bg-elevated" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  const chips = [
    ...stats.byStatus.map((row) => ({ key: row.status, label: row.status.replace('_', ' '), value: String(row.count) })),
    {
      key: 'avg',
      label: copy.stats.avgRating,
      value: stats.avgRating != null ? stats.avgRating.toFixed(1) : copy.stats.noRating
    }
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {chips.map((chip, i) => (
        <motion.div
          key={chip.key}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
        >
          <Card className="min-w-[8rem] px-4 py-3">
            <div className="text-h2 font-semibold text-foreground">{chip.value}</div>
            <div className="text-caption capitalize text-muted-foreground">{chip.label}</div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
