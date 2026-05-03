require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/org');
const aiRoutes = require('./routes/ai');
const queryRoutes = require('./routes/query');
const schemaRoutes = require('./routes/schema');
const sfToken = require('./middleware/sfToken');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/org', sfToken, orgRoutes);
app.use('/api/ai', sfToken, aiRoutes);
app.use('/api/query', sfToken, queryRoutes);
app.use('/api/schema', sfToken, schemaRoutes);

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`SF Dev Cockpit server running on http://localhost:${PORT}`));
}

module.exports = app;
