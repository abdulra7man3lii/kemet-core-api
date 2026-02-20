const express = require('express');
const router = express.Router();
const pipelineController = require('../controllers/pipelineController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/stages', pipelineController.getStages);
router.post('/stages', pipelineController.createStage);
router.patch('/stages/reorder', pipelineController.reorderStages);
router.patch('/stages/:id', pipelineController.updateStage);
router.delete('/stages/:id', pipelineController.deleteStage);

module.exports = router;
