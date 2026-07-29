// const authService = require('../services/auth.service');

// async function loginSchool(req, res) {
//     try {
//         const result = await authService.login({
//             email: req.body.email,
//             password: req.body.password,
//             portal: 'school'
//         });

//         res.json({ success: true, data: result });
//     } catch (err) {
//         res.status(err.statusCode || 500).json({
//             success: false,
//             message: err.message || 'Đăng nhập thất bại'
//         });
//     }
// }

// async function loginParent(req, res) {
//     try {
//         const result = await authService.login({
//             email: req.body.email,
//             password: req.body.password,
//             portal: 'parent'
//         });

//         res.json({ success: true, data: result });
//     } catch (err) {
//         res.status(err.statusCode || 500).json({
//             success: false,
//             message: err.message || 'Đăng nhập thất bại'
//         });
//     }
// }

// async function getMe(req, res) {
//     try {
//         const profile = await authService.getProfile(req.user.userId, req.user.portal);
//         res.json({ success: true, data: profile });
//     } catch (err) {
//         res.status(err.statusCode || 500).json({
//             success: false,
//             message: err.message || 'Không thể lấy thông tin người dùng'
//         });
//     }
// }

// module.exports = { loginSchool, loginParent, getMe };

const authService = require("../services/auth.service");

async function loginSchool(req, res) {
  try {
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
      portal: "school",
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Đăng nhập thất bại",
    });
  }
}

async function loginParent(req, res) {
  try {
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
      portal: "parent",
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Đăng nhập thất bại",
    });
  }
}

async function loginGoogleSchool(req, res) {
  try {
    const result =
      await authService.loginWithGoogle({
        credential: req.body.credential,
        portal: "school",
      });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message:
        err.message || "Đăng nhập Google thất bại",
    });
  }
}

async function loginGoogleParent(req, res) {
  try {
    const result =
      await authService.loginWithGoogle({
        credential: req.body.credential,
        portal: "parent",
      });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message:
        err.message || "Đăng nhập Google thất bại",
    });
  }
}

async function getMe(req, res) {
  try {
    const profile =
      await authService.getProfile(
        req.user.userId,
        req.user.portal,
      );

    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message:
        err.message ||
        "Không thể lấy thông tin người dùng",
    });
  }
}

module.exports = {
  loginSchool,
  loginParent,
  loginGoogleSchool,
  loginGoogleParent,
  getMe,
};