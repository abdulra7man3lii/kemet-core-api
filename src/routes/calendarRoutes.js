const express = require('express');
const {
    getCalendarEvents,
    createEvent
} = require('../controllers/calendarController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createEventSchema } = require('../validators/calendarValidator');

const router = express.Router();

router.use(protect);

router.get('/events', getCalendarEvents);
router.post('/events', validate(createEventSchema), createEvent);

module.exports = router;
