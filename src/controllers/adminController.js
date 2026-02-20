const { PrismaClient } = require('kemet-shared');
const prisma = new PrismaClient();

/**
 * Get platform-wide statistics for the SUPER_ADMIN.
 */
const getPlatformStats = async (req, res) => {
    try {
        const orgCount = await prisma.organization.count();
        const userCount = await prisma.user.count();
        const customerCount = await prisma.customer.count();
        const interactionCount = await prisma.interaction.count();

        res.json({
            orgCount,
            userCount,
            customerCount,
            interactionCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * List all organizations for the SUPER_ADMIN.
 */
const getAllOrganizations = async (req, res) => {
    try {
        const organizations = await prisma.organization.findMany({
            include: {
                subscription: {
                    include: {
                        plan: true
                    }
                },
                _count: {
                    select: { users: true, customers: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(organizations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get all subscription plans.
 */
const getAllPlans = async (req, res) => {
    try {
        const plans = await prisma.plan.findMany({
            orderBy: { price: 'asc' }
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new subscription plan.
 */
const createPlan = async (req, res) => {
    try {
        const { name, description, price, userLimit, features } = req.body;

        const plan = await prisma.plan.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                userLimit: parseInt(userLimit),
                features: Array.isArray(features) ? features : []
            }
        });

        res.json(plan);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Assign a subscription plan to an organization.
 */
const assignSubscription = async (req, res) => {
    try {
        const { id } = req.params; // Organization ID
        const { planId, status, endDate } = req.body;

        const subscription = await prisma.subscription.upsert({
            where: { organizationId: parseInt(id) },
            update: {
                planId: parseInt(planId),
                status: status || 'ACTIVE',
                endDate: endDate ? new Date(endDate) : null
            },
            create: {
                organizationId: parseInt(id),
                planId: parseInt(planId),
                status: status || 'ACTIVE',
                endDate: endDate ? new Date(endDate) : null
            }
        });

        res.json(subscription);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Initialize default luxury plans.
 */
const initializeDefaultPlans = async (req, res) => {
    try {
        const defaultPlans = [
            {
                name: 'Bronze Tier',
                description: 'Essential CRM for small teams.',
                price: 99,
                userLimit: 5,
                features: ['Core CRM', 'Leads Management', 'Basic Timeline']
            },
            {
                name: 'Gold Tier',
                description: 'Advanced data and finance tools.',
                price: 299,
                userLimit: 20,
                features: ['Core CRM', 'Data Laundry', 'Finance Hub', 'Internal Notes']
            },
            {
                name: 'Pharaoh Tier',
                description: 'Unlimited power and premium marketing.',
                price: 999,
                userLimit: 100,
                features: ['Core CRM', 'Data Laundry', 'Finance Hub', 'Marketing Engine', 'Custom Roles', 'Priority Staging']
            }
        ];

        const createdPlans = [];
        for (const plan of defaultPlans) {
            const p = await prisma.plan.upsert({
                where: { name: plan.name },
                update: plan,
                create: plan
            });
            createdPlans.push(p);
        }

        res.json(createdPlans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPlatformStats,
    getAllOrganizations,
    getAllPlans,
    createPlan,
    assignSubscription,
    initializeDefaultPlans
};
