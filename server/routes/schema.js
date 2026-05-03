const express = require('express');
const router = express.Router();

async function sfGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

// GET /api/schema/objects — list all SObjects
router.get('/objects', async (req, res) => {
  try {
    const data = await sfGet(
      `${req.sf.instance_url}/services/data/v60.0/sobjects`,
      req.sf.access_token
    );
    const objects = data.sobjects.map(o => ({
      name: o.name,
      label: o.label,
      queryable: o.queryable,
      custom: o.custom,
    }));
    res.json({ objects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schema/objects/:name — describe a specific object
router.get('/objects/:name', async (req, res) => {
  try {
    const data = await sfGet(
      `${req.sf.instance_url}/services/data/v60.0/sobjects/${req.params.name}/describe`,
      req.sf.access_token
    );
    const fields = data.fields.map(f => ({
      name: f.name,
      label: f.label,
      type: f.type,
      length: f.length,
      nillable: f.nillable,
    }));
    res.json({ name: data.name, label: data.label, fields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
