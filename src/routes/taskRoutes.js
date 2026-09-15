const router = require("express").Router();
const asyncHandler = require("../middleware/asyncHandler");
const requireAuth = require("../middleware/auth");
const ctrl = require("../controllers/taskController");

router.use(requireAuth);

router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));
router.put("/:id", asyncHandler(ctrl.update));
router.patch("/:id/stage", asyncHandler(ctrl.update)); // body just needs { stage }, update() handles both
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
