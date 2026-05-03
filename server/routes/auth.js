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
// Salesforce Authorization Code and Credentials Flow (headless + PKCE)
// Step 1: POST /authorize with response_type=code_credentials + user credentials → 302 with code
// Step 2: POST /token with grant_type=authorization_code + code_verifier → access token
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
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = crypto.randomBytes(16).toString('hex');

  try {
    // ── Step 1: exchange credentials for an authorization code ──────────────
    const authorizeParams = new URLSearchParams({
      response_type: 'code_credentials',
      client_id: SF_CLIENT_ID,
      redirect_uri: SF_REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      username: SF_USERNAME,
      password,
      nonce,
      state,
    });

    const basicAuth = Buffer.from(`${SF_CLIENT_ID}:${SF_CLIENT_SECRET}`).toString('base64');

    const authorizeRes = await fetch(
      `${SF_INSTANCE_URL}/services/oauth2/authorize`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: authorizeParams.toString(),
        redirect: 'manual',
      }
    );

    let code;

    if (authorizeRes.status === 302 || authorizeRes.status === 301) {
      const location = authorizeRes.headers.get('location');
      if (!location) {
        return res.status(500).json({ error: 'Salesforce returned a redirect with no Location header.' });
      }
      const locationUrl = new URL(location);
      const sfError = locationUrl.searchParams.get('error');
      if (sfError) {
        return res.status(400).json({
          error: locationUrl.searchParams.get('error_description') || sfError,
          sf_error: sfError,
          hint: getHint(sfError),
        });
      }
      code = locationUrl.searchParams.get('code');
    } else {
      const raw = await authorizeRes.text();
      let body;
      try { body = JSON.parse(raw); } catch { body = {}; }
      console.error('[auth] authorize step failed:', raw.slice(0, 500));
      return res.status(400).json({
        error: body.error_description || body.error || `Authorize step returned HTTP ${authorizeRes.status}`,
        sf_error: body.error,
        hint: getHint(body.error),
      });
    }

    if (!code) {
      return res.status(500).json({ error: 'No authorization code in the Salesforce redirect.' });
    }

    // ── Step 2: exchange code + PKCE verifier for an access token ───────────
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: SF_CLIENT_ID,
      redirect_uri: SF_REDIRECT_URI,
      code_verifier: verifier,
    });

    const tokenRes = await fetch(`${SF_INSTANCE_URL}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    const raw = await tokenRes.text();
    let tokenData;
    try { tokenData = JSON.parse(raw); } catch {
      console.error('[auth] token step non-JSON:', raw.slice(0, 500));
      return res.status(500).json({ error: 'Token exchange returned unexpected response. Check server logs.' });
    }

    if (!tokenRes.ok || tokenData.error) {
      return res.status(400).json({
        error: tokenData.error_description || tokenData.error || 'Token exchange failed',
        sf_error: tokenData.error,
        hint: getHint(tokenData.error),
      });
    }

    setSession({
      access_token: tokenData.access_token,
      instance_url: tokenData.instance_url,
    });

    res.json({
      connected: true,
      instance: tokenData.instance_url,
      org_id: tokenData.id,
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
      'Wrong username/password or bad security token. SF_PASSWORD should be password only; SF_SECURITY_TOKEN is the token from "Reset My Security Token" in Salesforce Settings.',
    invalid_client_credentials:
      'Check SF_USERNAME and SF_PASSWORD. Ensure "Enable Authorization Code and Credentials Flow" and "Require user credentials in POST body" are both ON in the Connected App.',
    invalid_client:
      'SF_CLIENT_ID or SF_CLIENT_SECRET is wrong. Copy them again from the Connected App in Salesforce Setup.',
    invalid_redirect_uri:
      'SF_REDIRECT_URI does not exactly match the Callback URL in the Connected App.',
    unsupported_response_type:
      'The Connected App does not have "Enable Authorization Code and Credentials Flow" enabled.',
    inactive_user:
      'The Salesforce user is inactive. Log in to Salesforce and confirm the user is active.',
  };
  return hints[sfError] || 'Double-check all values in your .env and the Connected App settings.';
}

module.exports = router;
