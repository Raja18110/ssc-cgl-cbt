const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const DEFAULT_PORT = process.env.PORT || 8085;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// REST API
app.use('/api', apiRoutes);

// Static assets
const PROJECT_ROOT = path.join(__dirname, '..');
app.use('/cards', express.static(path.join(PROJECT_ROOT, 'cards')));
app.use('/css', express.static(path.join(PROJECT_ROOT, 'css')));
app.use('/js', express.static(path.join(PROJECT_ROOT, 'js')));
app.use('/data', express.static(path.join(PROJECT_ROOT, 'data')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
});

// Start Server with auto-port retry
function startServer(port) {
  const server = app.listen(port, () => {
    console.log('=================================================================');
    console.log(` 🚀 SSC CGL Full-Stack CBT Platform Backend Running!`);
    console.log(` 🌐 URL: http://localhost:${port}`);
    console.log(` 📡 REST API: http://localhost:${port}/api/tests`);
    console.log('=================================================================');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(DEFAULT_PORT);
