const express = require('express');
const { registerUser,
    loginUser,
    getUsers,
    getMe,
    createOrgUser
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/rbacMiddleware');
const validate = require('../middleware/validationMiddleware');
const { registerSchema, loginSchema } = require('../validators/authValidator');
const { createUserSchema } = require('../validators/userValidator');

const router = express.Router();

router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.get('/users', protect, restrictTo('SUPER_ADMIN', 'ORG_ADMIN', 'Sales Agent'), getUsers);
router.get('/me', protect, getMe);
router.post('/users', protect, restrictTo('ORG_ADMIN', 'SUPER_ADMIN'), validate(createUserSchema), createOrgUser);

module.exports = router;
