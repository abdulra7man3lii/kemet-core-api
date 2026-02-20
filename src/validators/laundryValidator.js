const { z } = require('zod');

const createListSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'List name is required'),
        description: z.string().optional().nullable(),
    }),
});

const addContactSchema = z.object({
    params: z.object({
        listId: z.string().regex(/^\d+$/),
    }),
    body: z.object({
        name: z.string().min(1, 'Name is required').optional().default('Unknown'),
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable().or(z.literal('').transform(() => null)),
        language: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
    }),
});

const importToListSchema = z.object({
    params: z.object({
        listId: z.string().regex(/^\d+$/),
    }),
    body: z.object({
        mapping: z.string().min(1, 'Mapping is required'),
    }),
});

module.exports = {
    createListSchema,
    addContactSchema,
    importToListSchema,
};
