const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    contactNumber: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

// never let the hash leak out through res.json(user) by accident
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
