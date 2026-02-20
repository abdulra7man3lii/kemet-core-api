const { z } = require('zod');

const createRoleSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'Role name is required'),
        description: z.string().optional().nullable(),
        permissionIds: z.array(z.number().int()).min(1, 'At least one permission is required'),
    }),
});

const updateRoleSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/),
    }),
    body: z.object({
        name: z.string().min(2).optional(),
        description: z.string().optional().nullable(),
        permissionIds: z.array(z.number().int()).optional(),
    }),
});

const updateUserRoleSchema = z.object({
    body: z.object({
        userId: z.number().int().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
        roleId: z.number().int().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
    }),
});

module.exports = {
    createRoleSchema,
    updateRoleSchema,
    updateUserRoleSchema,
};
