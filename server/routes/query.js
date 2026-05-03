const express = require('express');
const router = express.Router();

// POST /api/query/run
router.post('/run', async (req, res) => {
  const { soql } = req.body;
  if (!soql) return res.status(400).json({ error: 'soql is required' });

  try {
    const encoded = encodeURIComponent(soql);
    const response = await fetch(
      `${req.sf.instance_url}/services/data/v60.0/query?q=${encoded}`,
      { headers: { Authorization: `Bearer ${req.sf.access_token}` } }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data[0]?.message || 'SOQL query failed' });
    }

    res.json({
      totalSize: data.totalSize,
      records: data.records,
      columns: data.records.length > 0
        ? Object.keys(data.records[0]).filter(k => k !== 'attributes')
        : [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
