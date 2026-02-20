const express = require('express');
const multer = require('multer');
const {
    getLists,
    getList,
    createList,
    getContacts,
    addContact,
    importToList,
    cleanList,
    deleteList,
    deleteContact,
    bulkDeleteInvalid,
    auditList
} = require('../controllers/laundryController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { createListSchema, addContactSchema, importToListSchema } = require('../validators/laundryValidator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.get('/lists', getLists);
router.get('/lists/:listId', getList);
router.post('/lists', validate(createListSchema), createList);
router.delete('/lists/:listId', deleteList);

router.get('/lists/:listId/contacts', getContacts);
router.post('/lists/:listId/contacts', validate(addContactSchema), addContact);
router.post('/lists/:listId/import', upload.single('file'), validate(importToListSchema), importToList);
router.post('/lists/:listId/clean', cleanList);
router.post('/lists/:listId/audit', auditList);
router.post('/lists/:listId/bulk-delete-invalid', bulkDeleteInvalid);
router.delete('/lists/:listId/contacts/:contactId', deleteContact);

module.exports = router;
