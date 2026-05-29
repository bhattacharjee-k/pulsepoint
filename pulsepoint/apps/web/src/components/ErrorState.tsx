import { AlertCircle } from 'lucide-react';

/** Inline error banner. role="alert" so screen readers announce it. */
export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-body text-cotton-rose-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span>{message}</span>
    </div>
  );
}
