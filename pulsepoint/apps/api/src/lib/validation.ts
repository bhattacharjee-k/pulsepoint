import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { sendError } from './errors.js';

export const feedbackTypeSchema = z.enum(['bug', 'feature', 'rating', 'other']);
export const feedbackStatusSchema = z.enum(['open', 'in_progress', 'resolved', 'closed']);

export const ingestPayloadSchema = z
  .object({
    type: feedbackTypeSchema,
    message: z.string().max(5000).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    contactEmail: z.string().email().optional(),
    captchaToken: z.string().optional(),
    submitter: z
      .object({
        externalId: z.string().max(255).optional(),
        email: z.string().email().optional(),
        displayName: z.string().max(255).optional()
      })
      .optional(),
    context: z
      .object({
        pageUrl: z.string().max(2048).optional(),
        userAgent: z.string().max(1024).optional(),
        referrer: z.string().max(2048).optional()
      })
      .optional()
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.type === 'rating') {
      if (value.rating === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rating'], message: 'Rating is required' });
      }
    } else if (!value.message || value.message.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['message'], message: 'Message is required' });
    }
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export function parseOrReply<T>(
  schema: z.ZodSchema<T>,
  value: unknown,
  reply: FastifyReply
): T | undefined {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    sendError(reply, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request');
    return undefined;
  }
  return parsed.data;
}
