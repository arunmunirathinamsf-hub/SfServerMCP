const express = require('express');
const router = express.Router();
const { setSession } = require('../middleware/sfToken');

// POST /api/auth/connect — OAuth 2.0 Username-Password flow
router.post('/connect', async (req, res) => {
  const { SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN } = process.env;

  // Security token only needed when IP is not trusted. If IP relaxation is ON in the Connected App, use password only.
  const password = SF_PASSWORD;

  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
    username: SF_USERNAME,
    password,
  });

  const tokenUrl = `${SF_INSTANCE_URL}/services/oauth2/token?${params.toString()}`;
  console.log('[auth] POST to:', tokenUrl.replace(/password=[^&]+/, 'password=***').replace(/client_secret=[^&]+/, 'client_secret=***'));

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = await response.json();

    if (!response.ok) {
      const sfError = data.error || 'unknown_error';
      const sfDesc = data.error_description || 'Authentication failed';

      const hints = {
        invalid_grant:
          'Wrong username/password or bad security token. SF_PASSWORD should be your password only (no token). SF_SECURITY_TOKEN should be the token from "Reset My Security Token" in Salesforce Settings. The token resets every time you change your password.',
        invalid_client_credentials:
          'Check SF_USERNAME and SF_PASSWORD. Also make sure "Allow OAuth Username-Password Flows" is ON in Salesforce Setup → OAuth and OpenID Connect Settings.',
        invalid_client:
          'SF_CLIENT_ID or SF_CLIENT_SECRET is wrong. Copy them again from the Connected App in Salesforce Setup.',
        inactive_user:
          'The Salesforce user is inactive. Log in to Salesforce and confirm the user is active.',
        login_must_use_security_token:
          'Your IP is not trusted. Put your Security Token in SF_SECURITY_TOKEN (not inside SF_PASSWORD).',
      };

      return res.status(400).json({
        error: sfDesc,
        sf_error: sfError,
        hint: hints[sfError] || 'Double-check all values in your .env file.',
      });
    }

    setSession({
      access_token: data.access_token,
      instance_url: data.instance_url,
    });

    // Fetch org info
    const orgRes = await fetch(`${data.instance_url}/services/data/v60.0/`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const orgData = await orgRes.json();

    res.json({
      connected: true,
      instance: data.instance_url,
      org_id: data.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/disconnect
router.post('/disconnect', (req, res) => {
  setSession(null);
  res.json({ connected: false });
});

module.exports = router;
