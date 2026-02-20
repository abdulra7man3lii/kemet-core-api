const express = require('express');
const multer = require('multer');
const {
    getStorageData,
    createFolder,
    uploadFile,
    deleteFile,
    deleteFolder
} = require('../controllers/storageController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createFolderSchema, uploadFileSchema } = require('../validators/storageValidator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.get('/', getStorageData);
router.post('/upload', upload.single('file'), validate(uploadFileSchema), uploadFile);
router.delete('/:id', deleteFile);

// Folder routes
router.post('/folders', validate(createFolderSchema), createFolder);
router.delete('/folders/:id', deleteFolder);

module.exports = router;
