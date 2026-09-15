const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { validateSignupPayload } = require("../utils/validators");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function signup(req, res) {
  const errors = validateSignupPayload(req.body);
  if (errors.length) throw new ApiError(400, "VALIDATION_ERROR", errors[0].message);

  const { name, username, email, password, contactNumber, avatarUrl } = req.body;

  // check both up front so we can return the right code instead of relying
  // solely on the unique-index race (that's still the real safety net below)
  const existing = await User.findOne({
    $or: [
      { username: new RegExp(`^${escapeRegex(username.trim())}$`, "i") },
      { email: email.trim().toLowerCase() },
    ],
  });
  if (existing) {
    const code = existing.email === email.trim().toLowerCase() ? "EMAIL_TAKEN" : "USERNAME_TAKEN";
    throw new ApiError(409, code, code === "EMAIL_TAKEN" ? "Email is already registered" : "Username is already taken");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: name.trim(),
    username: username.trim(),
    email: email.trim().toLowerCase(),
    contactNumber: contactNumber || null,
    avatarUrl: avatarUrl || null,
    passwordHash,
  });

  res.status(201).json({ success: true, data: user });
}

async function checkAvailability(req, res) {
  const { field, value } = req.query;
  if (!["username", "email"].includes(field) || !value) {
    return res.json({ available: true });
  }
  const query =
    field === "email"
      ? { email: value.trim().toLowerCase() }
      : { username: new RegExp(`^${escapeRegex(value.trim())}$`, "i") };
  const taken = await User.exists(query);
  res.json({ available: !taken });
}

async function login(req, res) {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    throw new ApiError(400, "VALIDATION_ERROR", "Username/email and password are required");
  }

  const user = await User.findOne({
    $or: [
      { username: new RegExp(`^${escapeRegex(identifier.trim())}$`, "i") },
      { email: identifier.trim().toLowerCase() },
    ],
  });

  const passwordOk = user && (await bcrypt.compare(password, user.passwordHash));
  if (!passwordOk) {
    // deliberately the same message whether the user doesn't exist or the
    // password is wrong - don't help an attacker enumerate accounts
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username/email or password");
  }

  const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
  });

  res.json({ success: true, data: { token, user } });
}

async function getSession(req, res) {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(401, "SESSION_EXPIRED", "Session expired, please log in again");
  res.json({ success: true, data: user });
}

// stateless JWTs can't really be "revoked" server-side without a blocklist,
// which felt like overkill here - logout is mostly the client dropping the
// token. Kept as a real endpoint anyway so the frontend has something to call.
async function logout(req, res) {
  res.json({ success: true });
}

module.exports = { signup, login, checkAvailability, getSession, logout };
