const { PrismaClient } = require('kemet-shared');

const prismaGlobal = globalThis;

// Instantiate PrismaClient only once
const prisma = prismaGlobal.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    prismaGlobal.prisma = prisma;
}

module.exports = prisma;
