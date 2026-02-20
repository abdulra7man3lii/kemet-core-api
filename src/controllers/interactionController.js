const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create a new interaction for a customer
const createInteraction = async (req, res) => {
    const { customerId, type, details, date } = req.body;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const role = req.user.role;
    const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';

    try {
        const customerIdInt = parseInt(customerId);
        if (isNaN(customerIdInt)) {
            return res.status(400).json({ message: 'Invalid customer ID' });
        }

        const customer = await prisma.customer.findFirst({
            where: {
                id: customerIdInt,
                ...(role === 'SUPER_ADMIN' ? {} : { organizationId }),
                ...(isRestricted ? {
                    OR: [
                        { createdById: userId },
                        { handlers: { some: { id: userId } } }
                    ]
                } : {})
            }
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found or access denied' });
        }

        const interaction = await prisma.interaction.create({
            data: {
                customerId: customerIdInt,
                userId,
                type,
                details,
                date: date ? new Date(date) : new Date()
            }
        });

        res.status(201).json(interaction);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Get interactions for a customer
const getInteractionsByCustomer = async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const role = req.user.role;
    const userId = req.user.id;
    const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';

    try {
        const customerIdInt = parseInt(id);
        if (isNaN(customerIdInt)) {
            return res.status(400).json({ message: 'Invalid customer ID' });
        }

        const customer = await prisma.customer.findFirst({
            where: {
                id: customerIdInt,
                ...(role === 'SUPER_ADMIN' ? {} : { organizationId }),
                ...(isRestricted ? {
                    OR: [
                        { createdById: userId },
                        { handlers: { some: { id: userId } } }
                    ]
                } : {})
            }
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found or access denied' });
        }

        const interactions = await prisma.interaction.findMany({
            where: { customerId: customerIdInt },
            include: {
                user: { select: { name: true, email: true } }
            },
            orderBy: { date: 'desc' }
        });

        res.json(interactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete an interaction
const deleteInteraction = async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const role = req.user.role;

    try {
        const interaction = await prisma.interaction.findFirst({
            where: {
                id: parseInt(id),
                customer: {
                    ...(role === 'SUPER_ADMIN' ? {} : { organizationId })
                }
            }
        });

        if (!interaction) {
            return res.status(404).json({ message: 'Interaction not found or unauthorized' });
        }

        await prisma.interaction.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Interaction deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createInteraction,
    getInteractionsByCustomer,
    deleteInteraction
};
