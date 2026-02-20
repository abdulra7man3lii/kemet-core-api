const { z } = require('zod');

const createInternalNoteSchema = z.object({
    body: z.object({
        customerId: z.number().int().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
        content: z.string().min(1, 'Note content cannot be empty'),
    }),
});

module.exports = {
    createInternalNoteSchema,
};
