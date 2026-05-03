const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { setSession } = require('../middleware/sfToken');

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// POST /api/auth/connect
// Salesforce Authorization Code and Credentials Flow (headless, PKCE-secured)
// Single request to /token — no browser redirect needed.
router.post('/connect', async (req, res) => {
  const {
    SF_INSTANCE_URL,
    SF_CLIENT_ID,
    SF_CLIENT_SECRET,
    SF_USERNAME,
    SF_PASSWORD,
    SF_SECURITY_TOKEN,
    SF_REDIRECT_URI,
  } = process.env;

  const password = SF_SECURITY_TOKEN ? SF_PASSWORD + SF_SECURITY_TOKEN : SF_PASSWORD;
  const { verifier, challenge } = generatePKCE();

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code_credentials',
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
      username: SF_USERNAME,
      password,
      redirect_uri: SF_REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      code_verifier: verifier,
    });

    const tokenUrl = `${SF_INSTANCE_URL}/services/oauth2/token`;
    console.log('[auth] headless POST to:', tokenUrl);

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    // Read as text first — Salesforce can return HTML on misconfigured orgs
    const raw = await tokenRes.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error('[auth] non-JSON response from Salesforce:\n', raw.slice(0, 500));
      return res.status(500).json({
        error: 'Salesforce returned an unexpected response (not JSON). Check server logs.',
        hint: 'Make sure "Enable Authorization Code and Credentials Flow" is checked in your Connected App, and that the Callback URL matches SF_REDIRECT_URI exactly.',
      });
    }

    if (!tokenRes.ok || data.error) {
      return res.status(400).json({
        error: data.error_description || data.error || 'Authentication failed',
        sf_error: data.error,
        hint: getHint(data.error),
      });
    }

    setSession({
      access_token: data.access_token,
      instance_url: data.instance_url,
    });

    res.json({
      connected: true,
      instance: data.instance_url,
      org_id: data.id,
    });
  } catch (err) {
    console.error('[auth] connect error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/disconnect
router.post('/disconnect', (req, res) => {
  setSession(null);
  res.json({ connected: false });
});

function getHint(sfError) {
  const hints = {
    invalid_grant:
      'Wrong username/password or bad security token. SF_PASSWORD should be your password only; SF_SECURITY_TOKEN is the token from "Reset My Security Token" in Salesforce Settings.',
    invalid_client_credentials:
      'Check SF_USERNAME and SF_PASSWORD. Ensure "Enable Authorization Code and Credentials Flow" is ON in the Connected App.',
    invalid_client:
      'SF_CLIENT_ID or SF_CLIENT_SECRET is wrong. Copy them again from the Connected App in Salesforce Setup.',
    invalid_redirect_uri:
      'SF_REDIRECT_URI does not match the Callback URL in the Connected App. They must be identical.',
    unsupported_grant_type:
      'The org does not support Authorization Code and Credentials Flow. Enable it in the Connected App under OAuth settings.',
    inactive_user:
      'The Salesforce user is inactive. Log in to Salesforce and confirm the user is active.',
  };
  return hints[sfError] || 'Double-check all values in your .env and the Connected App settings.';
}

module.exports = router;
