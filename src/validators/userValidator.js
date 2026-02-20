const { z } = require('zod');

const createUserSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        roleId: z.number().int().positive('Role ID is required'),
    }),
});

module.exports = {
    createUserSchema,
};
