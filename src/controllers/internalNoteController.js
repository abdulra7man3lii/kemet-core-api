const { PrismaClient } = require('kemet-shared');
const prisma = new PrismaClient();

// Create an internal note
const createInternalNote = async (req, res) => {
    const { customerId, content } = req.body;
    const { organizationId, role, id: userId } = req.user;

    try {
        const customerIdInt = parseInt(customerId);

        // 1. Verify customer belongs to org and agent has access
        const customer = await prisma.customer.findFirst({
            where: {
                id: customerIdInt,
                organizationId: organizationId,
                ...((role === 'EMPLOYEE' || role === 'Sales Agent') ? {
                    OR: [
                        { createdById: userId },
                        { handlers: { some: { id: userId } } }
                    ]
                } : {})
            }
        });

        if (!customer) {
            return res.status(403).json({ message: 'Forbidden: Cannot add notes to this customer.' });
        }

        const note = await prisma.internalNote.create({
            data: {
                content,
                customerId: customerIdInt,
                userId: userId,
                organizationId,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });
        res.status(201).json(note);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all internal notes for a customer
const getInternalNotesByCustomer = async (req, res) => {
    const { id: customerId } = req.params;
    const organizationId = req.user.organizationId;

    try {
        const isRestricted = req.user.role === 'EMPLOYEE' || req.user.role === 'Sales Agent';

        const notes = await prisma.internalNote.findMany({
            where: {
                customerId: parseInt(customerId),
                organizationId,
                ...(isRestricted ? { customer: { handlers: { some: { id: req.user.id } } } } : {})
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete an internal note
const deleteInternalNote = async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    try {
        const note = await prisma.internalNote.findFirst({
            where: {
                id: parseInt(id),
                organizationId,
            },
        });

        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }

        // Only the owner or an admin can delete a note
        const isAdmin = req.user.role === 'ORG_ADMIN' || req.user.role === 'SUPER_ADMIN';
        if (note.userId !== userId && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized to delete this note' });
        }

        await prisma.internalNote.delete({
            where: {
                id: parseInt(id),
                organizationId,
            },
        });

        res.json({ message: 'Internal note deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createInternalNote,
    getInternalNotesByCustomer,
    deleteInternalNote,
};
