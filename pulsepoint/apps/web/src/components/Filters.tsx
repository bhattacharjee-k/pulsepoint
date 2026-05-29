import { Search } from 'lucide-react';
import { copy } from '../copy';
import { Input } from './ui/input';
import { Select } from './ui/select';

export function Filters({
  status,
  type,
  q,
  onStatus,
  onType,
  onQ
}: {
  status: string;
  type: string;
  q: string;
  onStatus: (value: string) => void;
  onType: (value: string) => void;
  onQ: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-40">
        <Select aria-label="Filter by status" value={status} onChange={(e) => onStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
      </div>
      <div className="w-40">
        <Select aria-label="Filter by type" value={type} onChange={(e) => onType(e.target.value)}>
          <option value="">All types</option>
          <option value="bug">Bug</option>
          <option value="feature">Feature</option>
          <option value="rating">Rating</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search feedback"
          className="pl-9"
          placeholder={copy.inbox.searchPlaceholder}
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
      </div>
    </div>
  );
}
