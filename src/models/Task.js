const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // kept in sync with `name` on every save - lets us enforce case-insensitive
    // uniqueness with a real DB index instead of scanning + comparing in JS
    nameLower: { type: String, required: true },
    stage: { type: Number, enum: [0, 1, 2, 3], default: 0 },
    priority: { type: String, enum: ["high", "medium", "low"], required: true },
    deadline: { type: String, required: true }, // stored as ISO date string, matches what the frontend sends
  },
  { timestamps: true }
);

taskSchema.pre("validate", function (next) {
  if (this.isModified("name")) {
    this.nameLower = this.name.toLowerCase();
  }

  next();
});

// one unique constraint per user, not global - two different users can both have a "Ship v1" task
taskSchema.index({ userId: 1, nameLower: 1 }, { unique: true });

module.exports = mongoose.model("Task", taskSchema);
