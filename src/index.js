// src/index.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const app = require('./app');
const { testConnection } = require('./config/database');
const { initializeSchema } = require('./config/schema');

const PORT = process.env.PORT || 3000;

const start = async () => {
  await testConnection();
  await initializeSchema();
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running → http://localhost:${PORT}`);
    console.log(`📊 Dashboard    → http://localhost:${PORT}/dashboard`);
    console.log(`📄 API Docs     → http://localhost:${PORT}/api/docs\n`);
  });
};

start();