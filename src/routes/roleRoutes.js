const express = require('express');
const router = express.Router();
const {
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    getPermissions,
    updateUserRole
} = require('../controllers/roleController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/rbacMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createRoleSchema, updateRoleSchema, updateUserRoleSchema } = require('../validators/roleValidator');

// All role routes require authentication and at least ORG_ADMIN status
router.use(protect);
router.use(restrictTo('ORG_ADMIN', 'SUPER_ADMIN'));

router.get('/', getRoles);
router.post('/', validate(createRoleSchema), createRole);
router.put('/:id', validate(updateRoleSchema), updateRole);
router.delete('/:id', deleteRole);
router.get('/permissions', getPermissions);
router.post('/update-user-role', validate(updateUserRoleSchema), updateUserRole);

module.exports = router;
