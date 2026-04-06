import { handle } from 'hono/vercel';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import pipelineRoutes from '../server/routes/pipeline.js';
import chatRoutes from '../server/routes/chat.js';
import explainRoutes from '../server/routes/explain.js';
import proactiveRoutes from '../server/routes/proactive.js';
import userStateRoutes from '../server/routes/user-state.js';
import githubRoutes from '../server/routes/github.js';
import curatedRoutes from '../server/routes/curated.js';
import skillProfileRoutes from '../server/routes/skill-profile.js';

const app = new Hono().basePath('/api');

app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Mount routes
app.route('/pipeline', pipelineRoutes);
app.route('/chat', chatRoutes);
app.route('/explain', explainRoutes);
app.route('/proactive', proactiveRoutes);
app.route('/user-state', userStateRoutes);
app.route('/github', githubRoutes);
app.route('/curated', curatedRoutes);
app.route('/skill-profile', skillProfileRoutes);

export default handle(app);
