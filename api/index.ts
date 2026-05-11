import { handle } from 'hono/vercel';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';

import pipelineRoutes from '../server/routes/pipeline.js';
import chatRoutes from '../server/routes/chat.js';
import explainRoutes from '../server/routes/explain.js';
import proactiveRoutes from '../server/routes/proactive.js';
import userStateRoutes from '../server/routes/user-state.js';
import githubRoutes from '../server/routes/github.js';
import curatedRoutes from '../server/routes/curated.js';
import shareRoutes from '../server/routes/share.js';
import cxRoutes from '../server/routes/cx.js';

const app = new Hono().basePath('/api');

app.use('*', cors());
app.use('*', compress());

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
app.route('/share', shareRoutes);
app.route('/cx', cxRoutes);

export default handle(app);
