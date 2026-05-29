import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Variants cover both feedback `type` and `status` values, so a raw string can be passed.
const badgeVariants = cva('inline-flex items-center rounded-sm px-2 py-0.5 text-label font-medium capitalize', {
  variants: {
    variant: {
      default: 'bg-elevated text-muted-foreground',
      bug: 'bg-destructive/15 text-cotton-rose-300',
      feature: 'bg-primary/15 text-ink-black-200',
      rating: 'bg-mint-cream-600/20 text-mint-cream-300',
      other: 'bg-elevated text-muted-foreground',
      open: 'bg-primary/15 text-ink-black-200',
      in_progress: 'bg-mint-cream-600/15 text-mint-cream-300',
      resolved: 'bg-mint-cream-600/20 text-mint-cream-300',
      closed: 'bg-elevated text-muted-foreground'
    }
  },
  defaultVariants: { variant: 'default' }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: string;
}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant: variant as never }), className)} {...props} />;
}
