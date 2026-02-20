const { PrismaClient } = require('kemet-shared');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

/**
 * Get storage stats, files, and folders
 */
const getStorageData = async (req, res) => {
    const { organizationId } = req.user;
    const { folderId } = req.query;

    try {
        const parsedFolderId = folderId ? parseInt(folderId) : null;

        // Fetch folders in the current directory
        const folders = await prisma.folder.findMany({
            where: {
                organizationId,
                parentId: parsedFolderId
            },
            orderBy: { name: 'asc' }
        });

        // Fetch files in the current directory
        const files = await prisma.file.findMany({
            where: {
                organizationId,
                folderId: parsedFolderId
            },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // Fetch organization for stats
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: {
                subscription: {
                    include: { plan: true }
                }
            }
        });

        const storageLimit = organization.subscription?.plan?.storageLimit || 100; // in MB
        const storageLimitBytes = storageLimit * 1024 * 1024;
        const storageUsed = Number(organization.storageUsed);

        res.json({
            folders,
            files,
            stats: {
                used: storageUsed,
                limit: storageLimitBytes,
                percent: storageLimitBytes > 0 ? (storageUsed / storageLimitBytes) * 100 : 0
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new folder
 */
const createFolder = async (req, res) => {
    const { organizationId, id: userId } = req.user;
    const { name, parentId } = req.body;

    if (!name) return res.status(400).json({ message: 'Folder name is required' });

    try {
        const folder = await prisma.folder.create({
            data: {
                name,
                parentId: parentId ? parseInt(parentId) : null,
                organizationId,
                userId
            }
        });
        res.status(201).json(folder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Upload a file
 */
const uploadFile = async (req, res) => {
    const { organizationId, id: userId } = req.user;
    const { folderId } = req.body;

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        const fileSize = req.file.size;

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: { subscription: { include: { plan: true } } }
        });

        const storageLimit = (organization.subscription?.plan?.storageLimit || 100) * 1024 * 1024;
        const currentUsed = Number(organization.storageUsed);

        if (currentUsed + fileSize > storageLimit) {
            return res.status(403).json({ message: 'Storage limit exceeded. Please upgrade your plan.' });
        }

        // Ensure uploads directory exists
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `${Date.now()}-${req.file.originalname}`;
        const filePath = path.join(uploadDir, fileName);

        // Write the file to disk
        fs.writeFileSync(filePath, req.file.buffer);

        const file = await prisma.file.create({
            data: {
                name: req.file.originalname,
                url: `/uploads/${fileName}`, // Store the new fileName
                size: fileSize,
                type: req.file.mimetype,
                organizationId,
                userId,
                folderId: folderId ? parseInt(folderId) : null
            }
        });

        await prisma.organization.update({
            where: { id: organizationId },
            data: { storageUsed: { increment: fileSize } }
        });

        res.status(201).json(file);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Delete a file
 */
const deleteFile = async (req, res) => {
    const { id } = req.params;
    const { organizationId, role, id: userId } = req.user;

    try {
        const fileId = parseInt(id);
        const file = await prisma.file.findUnique({
            where: { id: fileId }
        });

        if (!file || file.organizationId !== organizationId) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (role === 'EMPLOYEE' && file.userId !== userId) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        await prisma.file.delete({ where: { id: fileId } });

        await prisma.organization.update({
            where: { id: organizationId },
            data: { storageUsed: { decrement: file.size } }
        });

        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Delete a folder
 */
const deleteFolder = async (req, res) => {
    const { id } = req.params;
    const { organizationId, role, id: userId } = req.user;

    try {
        const folderId = parseInt(id);
        const folder = await prisma.folder.findUnique({
            where: { id: folderId },
            include: { files: true, children: true }
        });

        if (!folder || folder.organizationId !== organizationId) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        if (role === 'EMPLOYEE' && folder.userId !== userId) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Preventive: Check if empty (or could implement recursive delete)
        if (folder.files.length > 0 || folder.children.length > 0) {
            return res.status(400).json({ message: 'Cannot delete a non-empty folder' });
        }

        await prisma.folder.delete({ where: { id: folderId } });
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getStorageData,
    createFolder,
    uploadFile,
    deleteFile,
    deleteFolder
};
