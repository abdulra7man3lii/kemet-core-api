const { z } = require('zod');

const createTaskSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional().nullable(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
        dueDate: z.string().datetime().optional().nullable().or(z.string().optional().nullable()), // Allow flexible date strings
        assignedToId: z.number().int().optional().nullable().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
        customerId: z.number().int().optional().nullable().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
    }),
});

const updateTaskSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/),
    }),
    body: z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        dueDate: z.string().datetime().optional().nullable().or(z.string().optional().nullable()),
        assignedToId: z.number().int().optional().nullable().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
    }),
});

module.exports = {
    createTaskSchema,
    updateTaskSchema,
};
