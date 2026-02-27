const authService = require("../services/auth.service.js");

exports.register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
    try {
      res.json({ user: req.user });
    } catch (err) {
      next(err);
    }
  };