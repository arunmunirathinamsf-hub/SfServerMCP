const express = require('express');
const router = express.Router();

async function sfGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

// GET /api/org/limits
router.get('/limits', async (req, res) => {
  try {
    const data = await sfGet(`${req.sf.instance_url}/services/data/v60.0/limits`, req.sf.access_token);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/org/users
router.get('/users', async (req, res) => {
  try {
    const data = await sfGet(
      `${req.sf.instance_url}/services/data/v60.0/query?q=SELECT+Id,Name,Username,IsActive,LastLoginDate+FROM+User+WHERE+IsActive=true+LIMIT+20`,
      req.sf.access_token
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/org/apex-jobs
router.get('/apex-jobs', async (req, res) => {
  try {
    const data = await sfGet(
      `${req.sf.instance_url}/services/data/v60.0/query?q=SELECT+Id,ApexClassId,Status,JobType,CreatedDate+FROM+AsyncApexJob+ORDER+BY+CreatedDate+DESC+LIMIT+10`,
      req.sf.access_token
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
