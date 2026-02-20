const express = require('express');
const {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    assignHandler,
    unassignHandler,
    getStats,
    updateStatus,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createCustomerSchema, updateCustomerSchema } = require('../validators/customerValidator');

const router = express.Router();

router.use(protect); // All customer routes are protected

router.post('/', validate(createCustomerSchema), createCustomer);
router.get('/', getCustomers);
router.get('/stats', getStats);
router.get('/:id', getCustomerById);
router.put('/:id', validate(updateCustomerSchema), updateCustomer);
router.delete('/:id', deleteCustomer);
router.post('/:id/assign', assignHandler);
router.post('/:id/unassign', unassignHandler);
router.patch('/:id/status', updateStatus);

module.exports = router;
