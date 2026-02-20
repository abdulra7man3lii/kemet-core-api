const express = require('express');
const {
    createInternalNote,
    getInternalNotesByCustomer,
    deleteInternalNote,
} = require('../controllers/internalNoteController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createInternalNoteSchema } = require('../validators/internalNoteValidator');

const router = express.Router();

router.use(protect); // All internal notes are private to the team

router.post('/', validate(createInternalNoteSchema), createInternalNote);
router.get('/customer/:id', getInternalNotesByCustomer);
router.delete('/:id', deleteInternalNote);

module.exports = router;
