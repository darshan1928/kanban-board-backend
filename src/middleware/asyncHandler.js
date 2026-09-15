// wraps an async route handler so a rejected promise gets forwarded to
// Express's error middleware instead of crashing the process
module.exports = function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
};
