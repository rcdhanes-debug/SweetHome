const errorHandler = (err, req, res, next) => {
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier.' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message.replace(/^.*Error:\s*/, '') });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate entry already exists.' });
  }
  const status = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Something went wrong on the server.';
  if (status >= 500) console.error(err);
  res.status(status).json({ message });
};

module.exports = errorHandler;
