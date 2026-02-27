const express = require("express");
const { register, login, me } = require("../controllers/auth.controller.js");
const auth = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", auth, me);

module.exports = router;