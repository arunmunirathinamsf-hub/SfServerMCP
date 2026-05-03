let sfSession = null;

function setSession(session) {
  sfSession = session;
}

function getSession() {
  return sfSession;
}

function sfToken(req, res, next) {
  if (!sfSession || !sfSession.access_token) {
    return res.status(401).json({ error: 'Not connected to Salesforce. Call /api/auth/connect first.' });
  }
  req.sf = sfSession;
  next();
}

module.exports = sfToken;
module.exports.setSession = setSession;
module.exports.getSession = getSession;
