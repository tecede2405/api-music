class AuthService {
  login(username, password) {
    const validUser = process.env.ADMIN_USERNAME || "admin";
    const validPass = process.env.ADMIN_PASSWORD || "123456";

    if (username === validUser && password === validPass) {
      return { success: true, message: "Đăng nhập thành công" };
    }

    return { success: false, message: "Sai tài khoản hoặc mật khẩu" };
  }
}

module.exports = new AuthService();