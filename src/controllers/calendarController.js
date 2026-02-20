const { PrismaClient } = require('kemet-shared');
const prisma = new PrismaClient();

/**
 * Get all calendar events, including customer interactions
 */
const getCalendarEvents = async (req, res) => {
    const { organizationId, role, id: userId } = req.user;

    try {
        const isEmployee = role === 'EMPLOYEE';

        // 1. Regular Events
        const events = await prisma.event.findMany({
            where: {
                organizationId,
                ...(isEmployee ? { userId } : {})
            },
            include: { customer: { select: { name: true } } }
        });

        // 2. Interactions (mapped to events)
        const interactions = await prisma.interaction.findMany({
            where: {
                organizationId,
                ...(isEmployee ? { user: { id: userId } } : {})
            },
            include: { customer: { select: { name: true } } }
        });

        // 3. Transform interactions into event format
        const interactionEvents = interactions.map(i => ({
            id: `int-${i.id}`,
            title: `${i.type}: ${i.customer.name}`,
            startTime: i.date,
            endTime: i.date, // Instant events
            type: 'INTERACTION',
            notes: i.notes,
            customerId: i.customerId
        }));

        res.json([...events, ...interactionEvents]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new calendar event
 */
const createEvent = async (req, res) => {
    const { title, description, startTime, endTime, customerId, location } = req.body;
    const { organizationId, id: userId, role } = req.user;

    try {
        if (customerId) {
            const customerIdInt = parseInt(customerId);
            const customer = await prisma.customer.findFirst({
                where: {
                    id: customerIdInt,
                    organizationId,
                    ...(role === 'EMPLOYEE' ? {
                        OR: [
                            { createdById: userId },
                            { handlers: { some: { id: userId } } }
                        ]
                    } : {})
                }
            });

            if (!customer) {
                return res.status(403).json({ message: 'Forbidden: Cannot create events for this customer.' });
            }
        }

        const event = await prisma.event.create({
            data: {
                title,
                description,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                location,
                organizationId,
                userId,
                customerId: customerId ? parseInt(customerId) : null
            }
        });
        res.status(201).json(event);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getCalendarEvents,
    createEvent
};
