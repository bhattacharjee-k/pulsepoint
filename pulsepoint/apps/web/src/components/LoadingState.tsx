/** Skeleton placeholder rows. Announces the loading label to assistive tech. */
export function LoadingState({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[72px] animate-pulse rounded-md border border-border bg-elevated" />
      ))}
    </div>
  );
}
