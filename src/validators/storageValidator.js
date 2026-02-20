const { z } = require('zod');

const createFolderSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Folder name is required'),
        parentId: z.number().int().optional().nullable().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
    }),
});

const uploadFileSchema = z.object({
    body: z.object({
        folderId: z.number().int().optional().nullable().or(z.string().regex(/^\d+$/).transform(v => parseInt(v))),
    }),
});

module.exports = {
    createFolderSchema,
    uploadFileSchema,
};
