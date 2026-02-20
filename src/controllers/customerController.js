const { PrismaClient } = require('kemet-shared');
const prisma = new PrismaClient();

// Create a new customer
const createCustomer = async (req, res) => {
    const { name, email, phone, company, status } = req.body;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    try {
        // Fetch user name for source tracking
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true }
        });
        const sourceName = user?.name || user?.email || 'Unknown User';

        // Determine default status if not provided
        let finalStatus = status;
        if (!finalStatus) {
            const firstStage = await prisma.pipelineStage.findFirst({
                where: { organizationId },
                orderBy: { order: 'asc' }
            });
            finalStatus = firstStage ? firstStage.name : 'NEW';
        }

        const customer = await prisma.customer.create({
            data: {
                name,
                email,
                phone,
                company,
                status: finalStatus,
                organizationId,
                createdById: userId,
                source: `User: ${sourceName}`,
                handlers: {
                    connect: { id: userId }
                }
            },
        });
        res.status(201).json(customer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Get all customers
const getCustomers = async (req, res) => {
    const { status, handlerId, search, orgId } = req.query;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const organizationId = isSuperAdmin && orgId ? parseInt(orgId) : req.user.organizationId;
    const userId = parseInt(req.user.id);

    try {
        const where = (isSuperAdmin && !orgId) ? {} : { organizationId };

        // 1. Status Filter
        if (status && status !== 'all') {
            where.status = status;
        }

        // 2. Role-based / Handler Isolation
        const isRestrictedRole = req.user.role === 'EMPLOYEE' || req.user.role === 'Sales Agent';

        if (isRestrictedRole) {
            // Logic: Leads I created OR leads I'm assigned to
            where.OR = [
                { createdById: userId },
                { handlers: { some: { id: userId } } }
            ];
        } else if (handlerId) {
            const hId = handlerId === 'me' ? userId : parseInt(handlerId);
            where.handlers = { some: { id: hId } };
        }

        // 3. Search Filter
        if (search) {
            const searchCondition = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { company: { contains: search, mode: 'insensitive' } },
                ]
            };

            if (where.OR) {
                const isolationOR = where.OR;
                delete where.OR;
                where.AND = [
                    { OR: isolationOR },
                    searchCondition
                ];
            } else {
                where.AND = [searchCondition];
            }
        }

        const customers = await prisma.customer.findMany({
            where,
            include: {
                createdBy: { select: { name: true, email: true } },
                handlers: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(customers);
    } catch (error) {
        console.error('getCustomers Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get a single customer by ID
const getCustomerById = async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isRestricted = req.user.role === 'EMPLOYEE' || req.user.role === 'Sales Agent';

    try {
        const customer = await prisma.customer.findFirst({
            where: {
                id: parseInt(id),
                ...(isSuperAdmin ? {} : { organizationId }),
                ...(isRestricted ? {
                    OR: [
                        { createdById: req.user.id },
                        { handlers: { some: { id: req.user.id } } }
                    ]
                } : {})
            },
            include: {
                createdBy: { select: { name: true, email: true } },
                handlers: { select: { id: true, name: true, email: true } },
                interactions: {
                    include: {
                        user: { select: { name: true, email: true } }
                    },
                    orderBy: { date: 'desc' }
                },
            },
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a customer
const updateCustomer = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, company, status } = req.body;
    const organizationId = req.user.organizationId;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isRestricted = req.user.role === 'EMPLOYEE' || req.user.role === 'Sales Agent';

    try {
        const customerCheck = await prisma.customer.findFirst({
            where: {
                id: parseInt(id),
                ...(isSuperAdmin ? {} : { organizationId }),
                ...(isRestricted ? {
                    OR: [
                        { createdById: req.user.id },
                        { handlers: { some: { id: req.user.id } } }
                    ]
                } : {})
            }
        });

        if (!customerCheck) {
            return res.status(404).json({ message: 'Customer not found or access denied' });
        }

        const customer = await prisma.customer.update({
            where: { id: parseInt(id) },
            data: { name, email, phone, company, status },
        });
        res.json(customer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a customer
const deleteCustomer = async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    if (req.user.role !== 'ORG_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Not authorized to delete customers' });
    }

    try {
        const customer = await prisma.customer.findFirst({
            where: {
                id: parseInt(id),
                ...(isSuperAdmin ? {} : { organizationId })
            }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        await prisma.$transaction([
            prisma.interaction.deleteMany({ where: { customerId: parseInt(id) } }),
            prisma.internalNote.deleteMany({ where: { customerId: parseInt(id) } }),
            prisma.task.deleteMany({ where: { customerId: parseInt(id) } }),
            prisma.event.deleteMany({ where: { customerId: parseInt(id) } }),
            prisma.file.deleteMany({ where: { customerId: parseInt(id) } }),
            prisma.customer.delete({ where: { id: parseInt(id) } }),
        ]);

        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Assign a handler to a customer
const assignHandler = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const { organizationId, role } = req.user;

    // Allow ORG_ADMIN, SUPER_ADMIN, and Sales Agent (for transfer)
    const isManager = role === 'ORG_ADMIN' || role === 'SUPER_ADMIN';
    const isAgent = role === 'Sales Agent';

    if (!isManager && !isAgent) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to assign leads.' });
    }

    try {
        const customer = await prisma.customer.update({
            where: {
                id: parseInt(id),
                ...(role === 'SUPER_ADMIN' ? {} : { organizationId }),
            },
            data: {
                handlers: {
                    connect: { id: parseInt(userId) }
                }
            },
            include: {
                handlers: { select: { id: true, name: true, email: true } }
            }
        });
        res.json(customer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Unassign a handler
const unassignHandler = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const { organizationId, role } = req.user;

    const isManager = role === 'ORG_ADMIN' || role === 'SUPER_ADMIN';
    const isAgent = role === 'Sales Agent';

    if (!isManager && !isAgent) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to unassign leads.' });
    }

    try {
        const customer = await prisma.customer.update({
            where: {
                id: parseInt(id),
                ...(role === 'SUPER_ADMIN' ? {} : { organizationId }),
            },
            data: {
                handlers: {
                    disconnect: { id: parseInt(userId) }
                }
            },
            include: {
                handlers: { select: { id: true, name: true, email: true } }
            }
        });
        res.json(customer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Get customer statistics
const getStats = async (req, res) => {
    const { orgId } = req.query;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const organizationId = isSuperAdmin && orgId ? parseInt(orgId) : req.user.organizationId;

    try {
        const isRestricted = req.user.role === 'EMPLOYEE' || req.user.role === 'Sales Agent';
        const baseWhere = {
            ...(isSuperAdmin && !orgId ? {} : { organizationId }),
            ...(isRestricted ? {
                OR: [
                    { createdById: req.user.id },
                    { handlers: { some: { id: req.user.id } } }
                ]
            } : {})
        };

        const pipelineStages = await prisma.pipelineStage.findMany({
            where: { organizationId },
            orderBy: { order: 'asc' }
        });

        const stages = pipelineStages.length > 0
            ? pipelineStages.map(s => s.name)
            : ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

        const counts = {};
        let total = 0;

        for (const stage of stages) {
            const count = await prisma.customer.count({
                where: { ...baseWhere, status: stage }
            });
            counts[stage] = count;
            total += count;
        }

        const myLeads = await prisma.customer.count({
            where: {
                organizationId,
                OR: [
                    { createdById: req.user.id },
                    { handlers: { some: { id: req.user.id } } }
                ]
            }
        });

        res.json({
            total,
            myLeads,
            stages: counts
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Quick status update (for Kanban drag-and-drop)
const updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const organizationId = req.user.organizationId;
    const isRestricted = req.user.role === 'EMPLOYEE' || req.user.role === 'Sales Agent';
    try {
        const customerCheck = await prisma.customer.findFirst({
            where: {
                id: parseInt(id),
                ...(isSuperAdmin ? {} : { organizationId }),
                ...(isRestricted ? {
                    OR: [
                        { createdById: req.user.id },
                        { handlers: { some: { id: req.user.id } } }
                    ]
                } : {})
            },
            select: { organizationId: true, status: true }
        });

        if (!customerCheck) return res.status(404).json({ message: 'Lead not found or access denied' });

        const pipelineStages = await prisma.pipelineStage.findMany({
            where: { organizationId: customerCheck.organizationId },
            select: { name: true }
        });

        const validStatuses = pipelineStages.length > 0
            ? pipelineStages.map(s => s.name)
            : ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const updated = await prisma.customer.update({
            where: { id: parseInt(id) },
            data: { status },
            include: {
                createdBy: { select: { name: true, email: true } },
                handlers: { select: { id: true, name: true, email: true } },
            },
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    assignHandler,
    unassignHandler,
    getStats,
    updateStatus,
};
