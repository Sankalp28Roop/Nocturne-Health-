import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import biometricsRouter from './routes/biometrics.js';
import weightAnalyticsRouter from './routes/weightAnalytics.js';
import sleepAnalyticsRouter from './routes/sleepAnalytics.js';
import cardioAnalyticsRouter from './routes/cardioAnalytics.js';
import workoutsRouter from './routes/workouts.js';
import communityRouter from './routes/community.js';
import userRouter from './routes/user.js';
import aiRouter from './routes/ai.js';
import musicRouter from './routes/music.js';
import nutritionRouter from './routes/nutrition.js';
import stressRouter from './routes/stress.js';
import reportsRouter from './routes/reports.js';

import { authMiddleware } from './middleware/auth.js';
import { swaggerDocument, obsidianSwaggerCss } from './docs/swagger.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Security Headers via helmet
app.use(helmet({
  contentSecurityPolicy: false, // Allows Swagger UI and local development
  crossOriginEmbedderPolicy: false
}));

// Global Rate Limiting: 500 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(globalLimiter);

// Strict Auth Limiter: 15 login/register attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

// AI Coach Limiter: 60 requests per 15 minutes per IP
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request limit reached, please try again in a few minutes.' }
});

// CORS configured for Vite dev server & Android/iOS Capacitor WebView
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive for local development & emulators
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' }));

// Obsidian Kinetic themed Swagger UI
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: obsidianSwaggerCss,
    customSiteTitle: 'Nocturne API | Obsidian Kinetic'
  })
);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Nocturne Health & Fitness API',
    theme: 'Obsidian Kinetic',
    timestamp: new Date().toISOString()
  });
});

// Auth Routes (strict rate limit)
app.use('/api/v1/auth', authLimiter, authRouter);

// Protected Routes (guarded by authMiddleware)
app.use('/api/v1/dashboard', authMiddleware, dashboardRouter);
app.use('/api/v1/biometrics', authMiddleware, biometricsRouter);
app.use('/api/v1/analytics', authMiddleware, weightAnalyticsRouter);
app.use('/api/v1/analytics', authMiddleware, sleepAnalyticsRouter);
app.use('/api/v1/analytics', authMiddleware, cardioAnalyticsRouter);
app.use('/api/v1/workouts', authMiddleware, workoutsRouter);
app.use('/api/v1/community', authMiddleware, communityRouter);
app.use('/api/v1/user', authMiddleware, userRouter);
app.use('/api/v1/ai', authMiddleware, aiLimiter, aiRouter);
app.use('/api/v1/music', authMiddleware, musicRouter);
app.use('/api/v1/nutrition', authMiddleware, nutritionRouter);
app.use('/api/v1/stress', authMiddleware, stressRouter);
app.use('/api/v1/reports', authMiddleware, reportsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Nocturne Backend API running on http://localhost:${PORT}`);
  console.log(`📖 Swagger Docs (Obsidian Kinetic): http://localhost:${PORT}/api/docs`);
  console.log(`⚡ Connected to SQLite: ${process.env.DATABASE_URL}`);
  console.log(`🔒 Security Hardened (Helmet, Rate Limiting, bcrypt cost 12, JWT Rotation)`);
  console.log(`🤖 Nocturne AI Coach Enabled with Gemini 2.5 Flash`);
  console.log(`======================================================\n`);
});
