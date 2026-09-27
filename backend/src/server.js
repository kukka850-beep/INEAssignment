require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { router: productsRouter } = require('./routes/products');
const cronRouter = require('./routes/cron');
const exportRouter = require('./routes/export');

const app = express();
app.use(express.json());
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

app.get('/', (req, res) => res.json({ status: 'ok', service: 'ine-price-tracker-backend' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/products', productsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/export', exportRouter);

app.use((err, req, res, next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));
