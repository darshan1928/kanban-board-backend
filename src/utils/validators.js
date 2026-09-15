// Same rules as src/utils/validationSchemas.js on the frontend. Client-side
// validation is a UX nicety, not security - anyone can hit these endpoints
// directly with curl/Postman, so the real checks live here.

const NAME_REGEX = /^[A-Za-z\s]{2,50}$/;
const USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{2,19}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PHONE_REGEX = /^[0-9]{10,15}$/;

function validateSignupPayload(body) {
  const errors = [];
  const { name, username, email, password, contactNumber } = body;

  if (!name || !NAME_REGEX.test(name.trim())) {
    errors.push({ field: "name", message: "Name should be 2-50 letters and spaces only" });
  }
  if (!username || !USERNAME_REGEX.test(username.trim())) {
    errors.push({ field: "username", message: "3-20 chars, letters/numbers/underscore, can't start with a digit" });
  }
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  }
  if (!password || !PASSWORD_REGEX.test(password)) {
    errors.push({ field: "password", message: "Min 8 chars incl. uppercase, lowercase, number & special character" });
  }
  if (contactNumber && !PHONE_REGEX.test(contactNumber.trim())) {
    errors.push({ field: "contactNumber", message: "Enter 10-15 digits only" });
  }

  return errors;
}

function validateTaskPayload(body, { partial = false } = {}) {
  const errors = [];
  const { name, priority, deadline } = body;

  if (!partial || name !== undefined) {
    if (!name || !name.trim() || name.trim().length > 80) {
      errors.push({ field: "name", message: "Task name is required and must be under 80 characters" });
    }
  }
  if (!partial || priority !== undefined) {
    if (!["high", "medium", "low"].includes(priority)) {
      errors.push({ field: "priority", message: "Priority must be high, medium or low" });
    }
  }
  if (!partial || deadline !== undefined) {
    if (!deadline || Number.isNaN(new Date(deadline).getTime())) {
      errors.push({ field: "deadline", message: "Deadline is required and must be a valid date" });
    }
  }

  return errors;
}

module.exports = { validateSignupPayload, validateTaskPayload };
