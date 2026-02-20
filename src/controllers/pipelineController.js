const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all pipeline stages for an organization
const getStages = async (req, res) => {
    const { orgId } = req.query;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const organizationId = isSuperAdmin && orgId ? parseInt(orgId) : req.user.organizationId;
    try {
        const stages = await prisma.pipelineStage.findMany({
            where: { organizationId },
            orderBy: { order: 'asc' }
        });
        res.json(stages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new pipeline stage
const createStage = async (req, res) => {
    const { name, color, order, orgId } = req.body;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const organizationId = isSuperAdmin && orgId ? parseInt(orgId) : req.user.organizationId;

    if (req.user.role !== 'ORG_ADMIN' && !isSuperAdmin) {
        return res.status(403).json({ message: 'Only admins can create stages' });
    }

    try {
        const stage = await prisma.pipelineStage.create({
            data: {
                name,
                color,
                order: order || 0,
                organizationId
            }
        });
        res.status(201).json(stage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update a pipeline stage
const updateStage = async (req, res) => {
    const { id } = req.params;
    const { name, color, order } = req.body;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const organizationId = req.user.organizationId;

    try {
        const existingStage = await prisma.pipelineStage.findFirst({
            where: {
                id: parseInt(id),
                ...(isSuperAdmin ? {} : { organizationId })
            }
        });

        if (!existingStage) {
            return res.status(404).json({ message: 'Stage not found or unauthorized' });
        }

        const stage = await prisma.pipelineStage.update({
            where: { id: parseInt(id) },
            data: { name, color, order }
        });
        res.json(stage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a pipeline stage
const deleteStage = async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const organizationId = req.user.organizationId;

    try {
        const stage = await prisma.pipelineStage.findFirst({
            where: {
                id: parseInt(id),
                ...(isSuperAdmin ? {} : { organizationId })
            }
        });

        if (!stage) {
            return res.status(404).json({ message: 'Stage not found or unauthorized' });
        }

        const leadCount = await prisma.customer.count({
            where: { status: stage.name, organizationId: stage.organizationId }
        });

        if (leadCount > 0) {
            return res.status(400).json({ message: 'Cannot delete stage that has leads' });
        }

        await prisma.pipelineStage.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Stage deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Reorder stages
const reorderStages = async (req, res) => {
    const { stages } = req.body; // Array of { id, order }
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const organizationId = req.user.organizationId;

    try {
        await prisma.$transaction(
            stages.map(s => prisma.pipelineStage.update({
                where: {
                    id: s.id,
                    ...(isSuperAdmin ? {} : { organizationId })
                },
                data: { order: s.order }
            }))
        );
        res.json({ message: 'Stages reordered' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getStages,
    createStage,
    updateStage,
    deleteStage,
    reorderStages
};
