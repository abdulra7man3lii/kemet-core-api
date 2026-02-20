const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const xlsx = require('xlsx');
const { cleanRow, cleanBatch } = require('../services/dataCleaningService');

/**
 * Preview the import from an uploaded Excel file.
 * Returns the first 10 rows and available columns so user can map them.
 */
const previewImport = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        const columns = Object.keys(data[0]);
        const preview = data.slice(0, 10);

        res.json({
            columns,
            preview,
            totalRows: data.length,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Process the full import using user-provided mapping.
 * Optimized for background processing with ImportJob tracking.
 */
const processImport = async (req, res) => {
    const { mapping, fileName } = req.body;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    if (!req.file || !mapping) {
        return res.status(400).json({ message: 'Missing file or mapping' });
    }

    try {
        const parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        // Create a Job record
        const job = await prisma.importJob.create({
            data: {
                fileName: fileName || 'Import',
                status: 'PROCESSING',
                totalRows: data.length,
                organizationId,
                userId
            }
        });

        // Respond immediately with jobId
        res.json({ message: 'Import started', jobId: job.id });

        // Run processing in background
        (async () => {
            try {
                const chunkSize = 50;
                let importedCount = 0;

                for (let i = 0; i < data.length; i += chunkSize) {
                    const chunk = data.slice(i, i + chunkSize);

                    // Clean chunk using potential Python engine
                    const rawData = chunk.map(row => ({
                        name: row[parsedMapping.name],
                        phone: row[parsedMapping.phone],
                        email: row[parsedMapping.email],
                        company: row[parsedMapping.company]
                    }));

                    const cleanedChunk = await cleanBatch(rawData);

                    const customersToInsert = cleanedChunk.map(c => ({
                        ...c,
                        organizationId,
                        createdById: userId
                    })).filter(c => c.email || c.phone);

                    const result = await prisma.customer.createMany({
                        data: customersToInsert,
                        skipDuplicates: true,
                    });

                    importedCount += result.count;

                    // Update progress
                    await prisma.importJob.update({
                        where: { id: job.id },
                        data: { processedRows: Math.min(i + chunkSize, data.length) }
                    });
                }

                await prisma.importJob.update({
                    where: { id: job.id },
                    data: { status: 'COMPLETED', processedRows: data.length }
                });
            } catch (error) {
                console.error(`Import Job ${job.id} failed:`, error);
                await prisma.importJob.update({
                    where: { id: job.id },
                    data: { status: 'FAILED' }
                });
            }
        })();

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get the status of an import job.
 */
const getJobStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const job = await prisma.importJob.findUnique({
            where: {
                id: parseInt(id),
                organizationId: req.user.organizationId
            }
        });

        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json(job);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    previewImport,
    processImport,
    getJobStatus
};
