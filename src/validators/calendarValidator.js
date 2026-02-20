const { z } = require('zod');

const createEventSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional().nullable(),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
        location: z.string().optional().nullable(),
        customerId: z.number().int().optional().nullable().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
    }),
});

module.exports = {
    createEventSchema,
};
