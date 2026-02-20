const { z } = require('zod');

const processImportSchema = z.object({
    body: z.object({
        mapping: z.string().or(z.object({})), // Allow object or JSON stringified
        fileName: z.string().optional(),
    }),
});

module.exports = {
    processImportSchema,
};
