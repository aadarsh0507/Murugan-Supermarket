import './config/loadEnv.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import categoryRoutes from './routes/categories.js';
import brandRoutes from './routes/brands.js';
import itemRoutes from './routes/items.js';
import billRoutes from './routes/bills.js';
import supplierRoutes from './routes/suppliers.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import mobileOrderRoutes from './routes/mobileOrders.js';
// import barcodeRoutes from './routes/barcodes.js';
import dashboardRoutes from './routes/dashboard.js';
import creditRoutes from './routes/credits.js';
import customerCreditRoutes from './routes/customerCredits.js';
import screenRoutes from './routes/screens.js';
import syncRoutes from './routes/sync.js';
import devRoutes from './routes/dev.js';
import { ensureDirectoryExists, uploadsRootDir } from './utils/uploads.js';
import cron from 'node-cron';
import { backupAndUpload } from './controllers/syncController.js';
import { runDailyBackup } from './jobs/dailyBackup.js';
import pool, { query, sequelize } from './db/index.js';
import { initGlobalDb, verifyGlobalConnection } from './db/globalDb.js';
import { runStoreCodeMigration } from './repositories/storeRepository.js';
// import { Screen, User } from './models/index.js'; #added store on new line
import { Screen, User, Store } from './models/index.js';
import { initializeScreens } from './services/screenService.js';
import { ensurePurchaseOrdersTables } from './scripts/ensurePurchaseOrdersTables.js';

const app = express();

// Security middleware
app.use(helmet());

// Compression middleware (gzip/brotli)
app.use(compression({
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ETag middleware for caching
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (data) {
    const dataString = JSON.stringify(data);
    const etag = crypto.createHash('md5').update(dataString).digest('hex');
    res.set('ETag', `"${etag}"`);

    if (req.headers['if-none-match'] === `"${etag}"`) {
      return res.status(304).end();
    }

    return originalJson.call(this, data);
  };
  next();
});

// Rate limiting

// CORS configuration - permissive for development
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200
}));

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (process.env.NODE_ENV) {
  app.use(morgan('dev'));
}

const verifyDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection();
    const [info] = await connection.query('SELECT DATABASE() AS db');
    await connection.ping();
    connection.release();
    console.log(`✅ Connected to MySQL${info[0]?.db ? ` (database: ${info[0].db})` : ''}`);
  } catch (error) {
    console.error('❌ MySQL connection error:', error);
    console.log('\n📋 Please verify that your MySQL server is running and MYSQL_URL is set in the .env file.');
    process.exit(1);
  }
};

await verifyDatabaseConnection();

// Initialize global database
initGlobalDb();

// Conditionally verify global database connection
if (process.env.ENABLE_GLOBAL_DB === "true") {
  await verifyGlobalConnection();
} else {
  console.log("ℹ️ Global DB verification skipped (client mode)");
}

await runStoreCodeMigration();

const syncModels = async () => {
  const shouldAlter = process.env.SEQUELIZE_SYNC_ALTER !== 'false';

  try {
    // Sync Store first since User has foreign key to stores table.
    // Store.sync with alter: false to avoid "Too many keys; max 64 keys allowed" (stores table is at the limit).
    await Store.sync({ alter: false });
    await Screen.sync({ alter: shouldAlter });
    await User.sync(); // Avoid ALTER churn on large legacy table
  } catch (error) {
    // console.error('❌ Failed to synchronize Screen/User models:', error); #added store on new line
    console.error('❌ Failed to synchronize models:', error);
    throw error;
  }
};

await syncModels();

await initializeScreens();

// Ensure non-sequelize legacy tables exist (prevents "table doesn't exist" errors)
try {
  await ensurePurchaseOrdersTables();
  console.log('✅ Purchase Orders tables ensured');
} catch (error) {
  console.warn('⚠️ Could not ensure Purchase Orders tables:', error?.message ?? error);
}

ensureDirectoryExists(uploadsRootDir);

// Serve static files from the same uploads directory used by multer.
app.use('/uploads', express.static(uploadsRootDir));

// Routes
app.use('/api/auth', authRoutes);
// The following routes are temporarily disabled for isolated auth testing:
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/mobile-orders', mobileOrderRoutes);
// app.use('/api/barcodes', barcodeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/customer-credits', customerCreditRoutes);
app.use('/api/screens', screenRoutes);
app.use('/api/sync-to-global', syncRoutes);
app.use('/api/dev', devRoutes);
// Backup and upload endpoint (direct route)
app.post('/api/backup-and-upload', backupAndUpload);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1 AS healthy');
    res.status(200).json({
      status: 'success',
      message: 'Murugan Mart API is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Database connection failed',
      error: process.env.NODE_ENV ? error.message : undefined
    });
  }
});

// Metrics endpoint
app.get('/api/metrics', async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const [connection] = await pool.query('SELECT DATABASE() AS db, CONNECTION_ID() AS connectionId');
    res.json({
      status: 'success',
      metrics: {
        uptime: process.uptime(),
        memory: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
        },
        database: {
          connectionId: connection?.connectionId || null,
          database: connection?.db || null
        },
        nodeVersion: process.version,
        platform: process.platform
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch metrics',
      error: process.env.NODE_ENV ? error.message : undefined
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Murugan Mart API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth'
    },
    documentation: 'API documentation available at /api/health'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status).json({
    status: 'error',
    message: process.env.NODE_ENV ? err.message : 'Something went wrong',
    ...(process.env.NODE_ENV && { stack: err.stack })
  });
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);

  // Daily backup at 1 PM – BACKUP_VOLUME_PATH = save in MySQL container volume; else BACKUP_DIR on host
  const backupTarget = process.env.BACKUP_VOLUME_PATH
    ? `Docker volume ${process.env.MYSQL_BACKUP_CONTAINER || 'mysql8'}:${process.env.BACKUP_VOLUME_PATH}`
    : (process.env.BACKUP_DIR || 'backups (default)');
  cron.schedule('0 13 * * *', () => runDailyBackup(), { timezone: process.env.BACKUP_TZ || 'Asia/Kolkata' });
  console.log(`🕐 Daily backup at 1 PM (${process.env.BACKUP_TZ || 'Asia/Kolkata'}) → ${backupTarget}`);
});

export default app;
