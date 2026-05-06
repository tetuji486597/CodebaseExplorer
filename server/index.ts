import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from 'dotenv';
config({ quiet: true });

import pipelineRoutes from './routes/pipeline.js';
import chatRoutes from './routes/chat.js';
import explainRoutes from './routes/explain.js';
import proactiveRoutes from './routes/proactive.js';
import userStateRoutes from './routes/user-state.js';
import githubRoutes from './routes/github.js';
import curatedRoutes from './routes/curated.js';
import skillProfileRoutes from './routes/skill-profile.js';
import quizRoutes from './routes/quiz.js';
import shareRoutes from './routes/share.js';
import cxRoutes from './routes/cx.js';
import adminRoutes from './routes/admin.js';

const app = new Hono();

app.use('*', cors({
  origin: process.env.CORS_ORIGIN || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
app.use('*', logger());

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Mount routes
app.route('/api/pipeline', pipelineRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/explain', explainRoutes);
app.route('/api/proactive', proactiveRoutes);
app.route('/api/user-state', userStateRoutes);
app.route('/api/github', githubRoutes);
app.route('/api/curated', curatedRoutes);
app.route('/api/skill-profile', skillProfileRoutes);
app.route('/api/quiz', quizRoutes);
app.route('/api/share', shareRoutes);
app.route('/api/cx', cxRoutes);
app.route('/api/admin', adminRoutes);

const port = parseInt(process.env.PORT || '3007');
console.log(`Server starting on port ${port}`);

serve({ fetch: app.fetch, port });
