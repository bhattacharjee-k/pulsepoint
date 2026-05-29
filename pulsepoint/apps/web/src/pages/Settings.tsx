import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy } from 'lucide-react';
import { api } from '../api';
import { copy } from '../copy';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

type WidgetSettings = Awaited<ReturnType<typeof api.settings>>;

/** Demo: infer the tenant's public key from the signed-in admin's email domain. */
function publicKeyForEmail(email: string): string {
  const domain = email.split('@')[1] ?? '';
  return domain.startsWith('delta') ? 'pk_delta_demo' : 'pk_alpha_demo';
}

export function Settings({ email }: { email: string }) {
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const publicKey = publicKeyForEmail(email);
  const snippet = `<script src="https://cdn.pulsepoint.app/embed.js" data-public-key="${publicKey}"></script>`;

  useEffect(() => {
    let active = true;
    api
      .settings()
      .then((s) => active && setSettings(s))
      .catch(() => active && setError(copy.inbox.error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable in this context — no-op */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex h-full max-w-2xl flex-col gap-5 overflow-y-auto p-6 scrollbar-thin"
    >
      <div>
        <h1 className="text-h1 text-foreground">{copy.settings.title}</h1>
        <p className="mt-1 text-body text-muted-foreground">{copy.settings.subtitle}</p>
      </div>

      {loading ? (
        <LoadingState label={copy.stats.loading} rows={2} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        settings && (
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body text-muted-foreground">Accent color</span>
                <span className="flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded-sm border border-border"
                    style={{ background: settings.accentColor }}
                  />
                  <code className="text-code text-foreground">{settings.accentColor}</code>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-body text-muted-foreground">Prompt text</span>
                <span className="text-right text-body text-foreground">{settings.promptText}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-body text-muted-foreground">Enabled types</span>
                <span className="flex flex-wrap justify-end gap-1.5">
                  {settings.enabledTypes.map((t) => (
                    <Badge key={t} variant={t}>
                      {t}
                    </Badge>
                  ))}
                </span>
              </div>
            </CardContent>
          </Card>
        )
      )}

      <Card>
        <CardHeader>
          <CardTitle>{copy.settings.installTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-body text-muted-foreground">{copy.settings.installBody}</p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 pr-24 text-code text-ink-black-200">
              {snippet}
            </pre>
            <Button variant="outline" size="sm" className="absolute right-2 top-2" onClick={copySnippet}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">{copy.settings.publicKeyHint}</p>
          <p className="text-caption text-muted-foreground">{copy.settings.demoKeysNote}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.settings.rotationTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body text-muted-foreground">{copy.settings.rotationBody}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
