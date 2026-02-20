const express = require('express');
const router = express.Router();
const {
    getPlatformStats,
    getAllOrganizations,
    getAllPlans,
    createPlan,
    assignSubscription,
    initializeDefaultPlans
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/rbacMiddleware');

// Only SUPER_ADMIN can access platform-level administration
router.use(protect);
router.use(restrictTo('SUPER_ADMIN'));

router.get('/stats', getPlatformStats);
router.get('/organizations', getAllOrganizations);

// Plan Management
router.get('/plans', getAllPlans);
router.post('/plans', createPlan);
router.post('/plans/initialize-defaults', initializeDefaultPlans);

// Subscription Management
router.post('/organizations/:id/subscription', assignSubscription);

module.exports = router;
