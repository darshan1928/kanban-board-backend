const Task = require("../models/Task");
const ApiError = require("../utils/ApiError");
const { validateTaskPayload } = require("../utils/validators");

async function list(req, res) {
  const tasks = await Task.find({ userId: req.userId }).sort({ createdAt: 1 });
  res.json({ success: true, data: tasks });
}

async function create(req, res) {
  const errors = validateTaskPayload(req.body);
  if (errors.length) throw new ApiError(400, "VALIDATION_ERROR", errors[0].message);

  const { name, priority, deadline } = req.body;
  const trimmedName = name.trim();

  // upfront check for a friendlier error - the unique index is still there
  // as the real guard if two requests land at the same time
  const duplicate = await Task.exists({ userId: req.userId, nameLower: trimmedName.toLowerCase() });
  if (duplicate) throw new ApiError(409, "TASK_NAME_DUPLICATE", "A task with this name already exists");

  const task = await Task.create({ userId: req.userId, name: trimmedName, priority, deadline, stage: 0 });
  res.status(201).json({ success: true, data: task });
}

async function update(req, res) {
  const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
  // 404 whether the task doesn't exist or belongs to someone else - don't
  // let a user probe which ids exist by comparing 403 vs 404
  if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "Task not found");

  const errors = validateTaskPayload(req.body, { partial: true });
  if (errors.length) throw new ApiError(400, "VALIDATION_ERROR", errors[0].message);

  if (req.body.name !== undefined) {
    const trimmedName = req.body.name.trim();
    const clash = await Task.exists({
      userId: req.userId,
      nameLower: trimmedName.toLowerCase(),
      _id: { $ne: task._id },
    });
    if (clash) throw new ApiError(409, "TASK_NAME_DUPLICATE", "A task with this name already exists");
    task.name = trimmedName;
  }

  if (req.body.priority !== undefined) task.priority = req.body.priority;
  if (req.body.deadline !== undefined) task.deadline = req.body.deadline;

  if (req.body.stage !== undefined) {
    const stage = Number(req.body.stage);
    if (!Number.isInteger(stage) || stage < 0 || stage > 3) {
      throw new ApiError(400, "VALIDATION_ERROR", "Stage must be an integer between 0 and 3");
    }
    task.stage = stage;
  }

  await task.save();
  res.json({ success: true, data: task });
}

async function remove(req, res) {
  const deleted = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!deleted) throw new ApiError(404, "TASK_NOT_FOUND", "Task not found");
  res.json({ success: true });
}

module.exports = { list, create, update, remove };
