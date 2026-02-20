const express = require('express');
const {
    createInteraction,
    getInteractionsByCustomer,
    deleteInteraction,
} = require('../controllers/interactionController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createInteractionSchema } = require('../validators/interactionValidator');

const router = express.Router();

router.use(protect); // All interaction routes are protected

router.post('/', validate(createInteractionSchema), createInteraction);
router.get('/customer/:id', getInteractionsByCustomer);
router.delete('/:id', deleteInteraction);

module.exports = router;
