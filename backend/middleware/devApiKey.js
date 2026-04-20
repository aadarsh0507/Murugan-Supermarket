export const requireDevApiKey = (req, res, next) => {
  const expected = process.env.DEV_API_KEY;
  if (!expected) {
    return res.status(500).json({
      status: 'error',
      message: 'DEV_API_KEY is not configured on the server.',
    });
  }

  const provided =
    req.headers['x-api-key'] ??
    req.headers['x-dev-api-key'] ??
    req.headers['authorization'];

  const key =
    typeof provided === 'string' && provided.toLowerCase().startsWith('bearer ')
      ? provided.slice('bearer '.length).trim()
      : (typeof provided === 'string' ? provided.trim() : '');

  if (!key || key !== expected) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or missing API key.',
    });
  }

  next();
};

