/**
 * Validation Middleware
 * Uses Zod schemas to validate request body, query, or params.
 */
const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (error) {
        const errors = error.errors || error.issues || [];
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.map(e => ({
                path: Array.isArray(e.path) ? e.path.join('.') : e.path,
                message: e.message
            }))
        });
    }
};

module.exports = validate;
