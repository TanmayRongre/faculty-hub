require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const { startKeepAlive } = require('./src/utils/keepAlive');

// Route Imports
const authRoutes = require('./src/routes/authRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const facultyRoutes = require('./src/routes/facultyRoutes');
const academicRoutes = require('./src/routes/academicRoutes');
const sheetsRoutes = require('./src/routes/sheetsRoutes');
const marksRoutes = require('./src/routes/marksRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const timetableRoutes = require('./src/routes/timetableRoutes');
const holidayRoutes = require('./src/routes/holidayRoutes');
const lectureRoutes = require('./src/routes/lectureRoutes');
const resourceRoutes = require('./src/routes/resourceRoutes');
const noticeRoutes = require('./src/routes/noticeRoutes');
const galleryRoutes = require('./src/routes/galleryRoutes');

// Connect to MongoDB
connectDB();

const app = express();

// Trust proxy on cloud platforms like Render / Vercel
app.set('trust proxy', 1);

// ─── Render-Optimized CORS Configuration ──────────────────────────────────────
const allowedOriginPatterns = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /\.onrender\.com$/,
  /\.vercel\.app$/,
  /\.netlify\.app$/,
  /\.github\.io$/,
];

const customOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server, cron jobs, curl, mobile apps, and self-pings (no origin header)
    if (!origin) return callback(null, true);

    // Check exact matches
    if (customOrigins.includes(origin)) return callback(null, true);

    // Check regex patterns (localhost, Vercel, Netlify, Render preview domains)
    const isPatternAllowed = allowedOriginPatterns.some((pattern) => pattern.test(origin));
    if (isPatternAllowed) return callback(null, true);

    // Allow during development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // Default allow with warning in production for maximum flexibility
    console.warn(`[CORS] Request from unmatched origin: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
  ],
  exposedHeaders: ['Content-Disposition', 'X-Total-Count'],
  maxAge: 86400, // Cache preflight OPTIONS responses for 24 hours (prevents cold-start round-trip latency)
  optionsSuccessStatus: 200, // For legacy browser compatibility
};

// Apply CORS globally (handles all standard requests and preflight OPTIONS in Express 5)
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Health Check & Keep-Alive Endpoint ───────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'FacultyHub API is active and running',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/gallery', galleryRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`FacultyHub server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  // Start the automated keep-alive ping engine to prevent 15-minute Render sleep
  startKeepAlive();
});

module.exports = app;
