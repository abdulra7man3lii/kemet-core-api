const { z } = require('zod');

const createCustomerSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address'),
        phone: z.string().optional().nullable(),
        company: z.string().optional().nullable(),
        status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']).optional().default('NEW'),
    }),
});

const updateCustomerSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/, 'ID must be a number'),
    }),
    body: z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional().nullable(),
        company: z.string().optional().nullable(),
        status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']).optional(),
    }),
});

module.exports = {
    createCustomerSchema,
    updateCustomerSchema,
};
