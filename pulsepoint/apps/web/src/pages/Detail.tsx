import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api, type FeedbackItem } from '../api';
import { copy } from '../copy';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { ErrorState } from '../components/ErrorState';

type Note = { id: string; body: string; authorEmail: string };

export function Detail({
  item,
  onStatusChange
}: {
  item: FeedbackItem | null;
  onStatusChange: (status: string) => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) {
      setNotes([]);
      return;
    }
    let active = true;
    setError('');
    setDraft('');
    api
      .getFeedback(item.id)
      .then((full) => active && setNotes(full.notes ?? []))
      .catch(() => active && setError(copy.inbox.error));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) {
    return (
      <Card className="grid h-full place-items-center p-8 text-center text-body text-muted-foreground">
        {copy.detail.empty}
      </Card>
    );
  }

  async function changeStatus(next: string) {
    if (!item) return;
    onStatusChange(next);
    try {
      await api.patchFeedback(item.id, { status: next });
    } catch {
      setError(copy.inbox.error);
    }
  }

  async function addNote() {
    if (!item || !draft.trim()) return;
    setBusy(true);
    try {
      await api.addNote(item.id, draft.trim());
      const full = await api.getFeedback(item.id);
      setNotes(full.notes ?? []);
      setDraft('');
    } catch {
      setError(copy.inbox.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={item.id}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.2 }}
        className="h-full"
      >
        <Card className="flex h-full flex-col gap-5 p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={item.type}>{item.type}</Badge>
              {item.rating != null && <Badge variant="rating">{item.rating}/5</Badge>}
            </div>
            <h2 className="text-h2 text-foreground">
              {item.message ?? (item.rating ? `Rating: ${item.rating}/5` : '—')}
            </h2>
            <p className="text-caption text-muted-foreground">
              {item.submitterDisplayName ?? item.submitterEmail ?? copy.detail.anonymous}
            </p>
          </div>

          <div className="max-w-[220px] space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={item.status} onChange={(e) => changeStatus(e.target.value)}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <h3 className="text-h3 text-foreground">{copy.detail.notesTitle}</h3>
            {error && <ErrorState message={error} />}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto scrollbar-thin">
              {notes.map((note) => (
                <div key={note.id} className="rounded-md border border-border bg-elevated p-3">
                  <p className="text-body text-foreground">{note.body}</p>
                  <p className="mt-1 text-caption text-muted-foreground">{note.authorEmail}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="note" className="sr-only">
                {copy.detail.notesTitle}
              </Label>
              <Textarea
                id="note"
                rows={3}
                placeholder={copy.detail.notesPlaceholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button size="sm" onClick={addNote} disabled={busy || !draft.trim()}>
                {copy.detail.notesSubmit}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
