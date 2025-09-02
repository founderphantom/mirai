import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/error.middleware.js';
import { requestLogger } from './middleware/logging.middleware.js';
import { rateLimiter } from './middleware/rateLimit.middleware.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { connectDatabase } from './database/connection.js';
import { initializeRedis } from './services/redis.service.js';
import { initializeSocketServer } from './websocket/index.js';

// Import routers
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import conversationRouter from './routes/conversation.routes.js';
import chatRouter from './routes/chat.routes.js';
import subscriptionRouter from './routes/subscription.routes.js';
import usageRouter from './routes/usage.routes.js';
import providerRouter from './routes/provider.routes.js';
import webhookRouter from './routes/webhook.routes.js';
import healthRouter from './routes/health.routes.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO if enabled
let io: SocketIOServer | null = null;
if (config.features.enableWebsockets) {
  io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.origins,
      credentials: true
    }
  });
  initializeSocketServer(io);
}

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: config.cors.origins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(requestLogger);

// Rate limiting (skip for webhooks)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1/webhooks')) {
    return next();
  }
  return rateLimiter(req, res, next);
});

// API Routes
const apiPrefix = `/api/${config.api.version}`;

app.use(`${apiPrefix}/auth`, authRouter);
app.use(`${apiPrefix}/users`, userRouter);
app.use(`${apiPrefix}/conversations`, conversationRouter);
app.use(`${apiPrefix}/chat`, chatRouter);
app.use(`${apiPrefix}/subscriptions`, subscriptionRouter);
app.use(`${apiPrefix}/usage`, usageRouter);
app.use(`${apiPrefix}/providers`, providerRouter);
app.use(`${apiPrefix}/webhooks`, webhookRouter);
app.use(`${apiPrefix}/health`, healthRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Mirai API Server',
    version: config.api.version,
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested endpoint ${req.method} ${req.path} does not exist`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async () => {
  logger.info('Starting graceful shutdown...');
  
  // Close Socket.IO connections
  if (io) {
    io.close(() => {
      logger.info('Socket.IO server closed');
    });
  }
  
  // Close server
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close database connections
  // await closeDatabase();
  
  // Close Redis connection
  // await closeRedis();
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async () => {
  try {
    // Initialize database connection
    await connectDatabase();
    logger.info('Database connection established');
    
    // Initialize Redis if enabled
    if (config.features.enableCache) {
      await initializeRedis();
      logger.info('Redis connection established');
    }
    
    // Start listening
    server.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port} in ${config.server.env} mode`);
      logger.info(`API endpoints available at http://localhost:${config.server.port}/api/${config.api.version}`);
      
      if (config.features.enableWebsockets) {
        logger.info('WebSocket server is enabled');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export { app, server, io };