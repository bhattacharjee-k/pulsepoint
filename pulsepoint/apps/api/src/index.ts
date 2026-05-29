import Fastify from 'fastify';
import { authRoutes } from './routes/auth.js';
import { feedbackRoutes } from './routes/feedback.js';
import { publicFeedbackRoutes } from './routes/public/feedback.js';
import { widgetConfigRoutes } from './routes/public/widgetConfig.js';
import { settingsRoutes } from './routes/settings.js';
import { statsRoutes } from './routes/stats.js';
import { teamRoutes } from './routes/team.js';
import { registerCors } from './plugins/cors.js';
import { registerRateLimit } from './plugins/rateLimit.js';
import { registerSession } from './plugins/session.js';
import { sendError } from './lib/errors.js';
import { config } from './config.js';

export async function buildApp() {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' });
  await registerCors(app);
  await registerSession(app);
  await registerRateLimit(app);

  app.get('/health', async () => ({ ok: true }));

  await app.register(
    async (v1) => {
      await v1.register(widgetConfigRoutes);
      await v1.register(publicFeedbackRoutes);
      await v1.register(authRoutes);
      await v1.register(feedbackRoutes);
      await v1.register(statsRoutes);
      await v1.register(settingsRoutes);
      await v1.register(teamRoutes);
    },
    { prefix: '/api/v1' }
  );

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    sendError(reply, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = await buildApp();
  await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
}
