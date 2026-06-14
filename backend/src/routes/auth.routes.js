const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/login/school', authController.loginSchool);
router.post('/login/parent', authController.loginParent);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
