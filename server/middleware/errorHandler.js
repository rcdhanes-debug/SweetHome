const errorHandler = (err, req, res, next) => {
  console.error(`[Error Handler] ${req.method} ${req.originalUrl}: ${err.name} - ${err.message}`, err);

  if (err.name === 'CastError') {
    const field = err.path || 'identifier';
    return res.status(400).json({ message: `Invalid ${field}.` });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message.replace(/^.*Error:\s*/, '') });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate entry already exists.' });
  }
  const status = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Something went wrong on the server.';
  res.status(status).json({ message });
};

module.exports = errorHandler;

