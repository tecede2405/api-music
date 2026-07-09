const authService = require("../services/auth.service");

class AuthController {
  login(req, res) {
    const { username, password } = req.body;
    const result = authService.login(username, password);

    if (result.success) {
      return res.json(result);
    }

    return res.status(401).json(result);
  }
}

module.exports = new AuthController();