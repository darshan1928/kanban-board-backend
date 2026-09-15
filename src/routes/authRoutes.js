const router = require("express").Router();
const asyncHandler = require("../middleware/asyncHandler");
const requireAuth = require("../middleware/auth");
const ctrl = require("../controllers/authController");

router.post("/signup", asyncHandler(ctrl.signup));
router.get("/availability", asyncHandler(ctrl.checkAvailability));
router.post("/login", asyncHandler(ctrl.login));
router.get("/session", requireAuth, asyncHandler(ctrl.getSession));
router.post("/logout", requireAuth, asyncHandler(ctrl.logout));

module.exports = router;
