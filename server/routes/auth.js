const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { setSession } = require('../middleware/sfToken');

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// POST /api/auth/connect — Salesforce Headless (Authorization Code + Credentials + PKCE)
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
    // Step 1 — headless authorize: exchange credentials + PKCE challenge for an auth code
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
      `${SF_INSTANCE_URL}/services/oauth2/authorize/headless`,
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

    // Salesforce returns 302 → redirect_uri?code=...&state=...
    let code;
    if (authorizeRes.status === 302 || authorizeRes.status === 301) {
      const location = authorizeRes.headers.get('location');
      if (!location) throw new Error('Headless authorize returned redirect with no Location header');
      code = new URL(location).searchParams.get('code');
    } else {
      // Some orgs return 200 with JSON body containing the code
      const body = await authorizeRes.json();
      if (!authorizeRes.ok || body.error) {
        return res.status(400).json({
          error: body.error_description || body.error || 'Headless authorize failed',
          sf_error: body.error,
          hint: getHint(body.error),
        });
      }
      code = body.code;
    }

    if (!code) throw new Error('No authorization code returned from Salesforce headless flow');

    // Step 2 — exchange auth code + PKCE verifier for access token
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

    const tokenData = await tokenRes.json();

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
    console.error('[auth] headless connect error:', err.message);
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
      'Wrong username/password or bad security token. Ensure SF_PASSWORD is your password only and SF_SECURITY_TOKEN is the token from "Reset My Security Token" in Salesforce Settings.',
    invalid_client_credentials:
      'Check SF_USERNAME and SF_PASSWORD. Also ensure "Enable Authorization Code and Credentials Flow" is ON in the Connected App.',
    invalid_client:
      'SF_CLIENT_ID or SF_CLIENT_SECRET is wrong. Copy them again from the Connected App in Salesforce Setup.',
    invalid_redirect_uri:
      'SF_REDIRECT_URI does not match the Callback URL registered in the Connected App. They must be identical.',
    inactive_user:
      'The Salesforce user is inactive. Log in to Salesforce and confirm the user is active.',
  };
  return hints[sfError] || 'Double-check all values in your .env file and the Connected App settings.';
}

module.exports = router;
