const { z } = require('zod');

const createInteractionSchema = z.object({
    body: z.object({
        type: z.string().min(1, 'Type is required'),
        notes: z.string().optional().nullable(),
        date: z.string().datetime().optional().nullable().or(z.string().optional().nullable()),
        customerId: z.number().int().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
    }),
});

module.exports = {
    createInteractionSchema,
};
