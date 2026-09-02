require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
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

// Middleware
app.use(cors({
  origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, process.env.CLIENT_URL].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'FacultyHub API is running', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`FacultyHub server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app;
