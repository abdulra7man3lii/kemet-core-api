const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get all tasks for the current user/organization
 */
const getTasks = async (req, res) => {
    const { organizationId, role, id: userId } = req.user;

    try {
        let where = { organizationId };

        const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';
        if (isRestricted) {
            // Agents see tasks assigned to them OR created by them
            where.OR = [
                { assignedToId: userId },
                { createdById: userId }
            ];
        }

        const tasks = await prisma.task.findMany({
            where,
            include: {
                assignedTo: { select: { id: true, name: true, email: true } },
                createdBy: { select: { id: true, name: true, email: true } },
                customer: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new task
 */
const createTask = async (req, res) => {
    const { title, description, priority, dueDate, assignedToId, customerId } = req.body;
    const { organizationId, role, id: userId } = req.user;

    try {
        // Security: Employees can only create tasks for themselves or unassigned tasks (private)
        // CEO can assign to anyone
        let targetAssigneeId = assignedToId ? parseInt(assignedToId) : userId;

        const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';
        if (isRestricted && targetAssigneeId !== userId) {
            return res.status(403).json({ message: 'Agents can only create or assign tasks to themselves.' });
        }

        const task = await prisma.task.create({
            data: {
                title,
                description,
                priority: priority || 'MEDIUM',
                dueDate: dueDate ? new Date(dueDate) : null,
                organizationId,
                createdById: userId,
                assignedToId: targetAssigneeId,
                customerId: customerId ? parseInt(customerId) : null
            },
            include: {
                assignedTo: { select: { id: true, name: true } }
            }
        });

        res.status(201).json(task);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Update task status or details
 */
const updateTask = async (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assignedToId } = req.body;
    const { organizationId, role, id: userId } = req.user;

    try {
        const taskId = parseInt(id);
        const existingTask = await prisma.task.findUnique({
            where: { id: taskId }
        });

        if (!existingTask || existingTask.organizationId !== organizationId) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Security check for update
        const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';
        if (isRestricted && existingTask.assignedToId !== userId && existingTask.createdById !== userId) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to update this task.' });
        }

        const task = await prisma.task.update({
            where: { id: taskId },
            data: {
                title,
                description,
                status,
                priority,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                assignedToId: assignedToId ? parseInt(assignedToId) : undefined
            }
        });

        res.json(task);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Delete a task
 */
const deleteTask = async (req, res) => {
    const { id } = req.params;
    const { organizationId, role, id: userId } = req.user;

    try {
        const taskId = parseInt(id);
        const existingTask = await prisma.task.findUnique({
            where: { id: taskId }
        });

        if (!existingTask || existingTask.organizationId !== organizationId) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Security: Employees can only delete tasks they created
        const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';
        if (isRestricted && existingTask.createdById !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only delete tasks you created.' });
        }

        await prisma.task.delete({ where: { id: taskId } });
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getTasks,
    createTask,
    updateTask,
    deleteTask
};
