const ApiError = require("../utils/ApiError");

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  }

  // Mongo duplicate key error (e.g. two signups racing on the same email,
  // or a task name collision caught by the unique index instead of our
  // upfront check)
  if (err.code === 11000) {
    const keys = Object.keys(err.keyPattern || {});
    let code = "DUPLICATE";
    let message = "Already exists";
    if (keys.includes("nameLower")) {
      code = "TASK_NAME_DUPLICATE";
      message = "A task with this name already exists";
    } else if (keys.includes("email")) {
      code = "EMAIL_TAKEN";
      message = "Email is already registered";
    } else if (keys.includes("username")) {
      code = "USERNAME_TAKEN";
      message = "Username is already taken";
    }
    return res.status(409).json({ success: false, error: { code, message } });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: err.message } });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ success: false, error: { code: "BAD_ID", message: "Invalid id format" } });
  }

  console.error(err); // anything else is unexpected - worth seeing in the logs
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
};
