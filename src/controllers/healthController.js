const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const checkHealth = async (req, res) => {
    const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        response_time: process.hrtime(),
        database: 'DISCONNECTED',
    };

    try {
        // Simple query to check DB connection
        await prisma.$queryRaw`SELECT 1`;
        healthcheck.database = 'CONNECTED';
        res.send(healthcheck);
    } catch (error) {
        healthcheck.message = error.message;
        res.status(503).send(healthcheck);
    }
};

module.exports = { checkHealth };
