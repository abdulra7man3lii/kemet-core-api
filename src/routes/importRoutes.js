const express = require('express');
const router = express.Router();
const multer = require('multer');
const { previewImport, processImport, getJobStatus } = require('../controllers/importController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/rbacMiddleware');
const validate = require('../middleware/validationMiddleware');
const { processImportSchema } = require('../validators/importValidator');

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Protect all import routes
router.use(protect);

router.post('/preview', upload.single('file'), previewImport);
router.post('/process', upload.single('file'), restrictTo('ORG_ADMIN', 'SUPER_ADMIN'), validate(processImportSchema), processImport);
router.get('/job/:id', getJobStatus);

module.exports = router;
