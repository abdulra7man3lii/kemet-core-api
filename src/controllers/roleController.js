const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getRoles = async (req, res) => {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    try {
        const roles = await prisma.role.findMany({
            where: {
                OR: [
                    {
                        isGlobal: true,
                        ...(isSuperAdmin ? {} : { NOT: { name: 'SUPER_ADMIN' } })
                    },
                    {
                        ...(isSuperAdmin ? {} : { organizationId: req.user.organizationId })
                    }
                ]
            },
            include: {
                permissions: true,
                _count: {
                    select: { users: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(roles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createRole = async (req, res) => {
    const { name, description, permissionIds, orgId } = req.body;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const organizationId = isSuperAdmin && orgId ? parseInt(orgId) : req.user.organizationId;

    try {
        const globalRole = await prisma.role.findFirst({
            where: { name, isGlobal: true }
        });

        if (globalRole) {
            return res.status(400).json({ message: 'Cannot use a system-reserved role name.' });
        }

        const role = await prisma.role.create({
            data: {
                name,
                description,
                organizationId,
                isGlobal: false,
                permissions: {
                    connect: permissionIds.map(id => ({ id }))
                }
            },
            include: { permissions: true }
        });

        res.status(201).json(role);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateRole = async (req, res) => {
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    try {
        const roleId = parseInt(id);
        const existingRole = await prisma.role.findUnique({
            where: { id: roleId }
        });

        if (!existingRole) {
            return res.status(404).json({ message: 'Role not found.' });
        }

        if (existingRole.isGlobal || (!isSuperAdmin && existingRole.organizationId !== req.user.organizationId)) {
            return res.status(403).json({ message: 'Cannot modify global or unauthorized roles.' });
        }

        const updatedRole = await prisma.role.update({
            where: { id: roleId },
            data: {
                name,
                description,
                permissions: {
                    set: permissionIds.map(id => ({ id }))
                }
            },
            include: { permissions: true }
        });

        res.json(updatedRole);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteRole = async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    try {
        const roleId = parseInt(id);
        const existingRole = await prisma.role.findUnique({
            where: { id: roleId },
            include: { _count: { select: { users: true } } }
        });

        if (!existingRole) {
            return res.status(404).json({ message: 'Role not found.' });
        }

        if (existingRole.isGlobal || (!isSuperAdmin && existingRole.organizationId !== req.user.organizationId)) {
            return res.status(403).json({ message: 'Cannot delete global or unauthorized roles.' });
        }

        if (existingRole._count.users > 0) {
            return res.status(400).json({ message: 'Cannot delete a role that is currently assigned to users.' });
        }

        await prisma.role.delete({
            where: { id: roleId }
        });

        res.json({ message: 'Role deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPermissions = async (req, res) => {
    try {
        const permissions = await prisma.permission.findMany({
            orderBy: [
                { subject: 'asc' },
                { action: 'asc' }
            ]
        });
        res.json(permissions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateUserRole = async (req, res) => {
    const { userId, roleId } = req.body;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    try {
        const targetUser = await prisma.user.findUnique({
            where: { id: parseInt(userId) }
        });

        if (!targetUser || (!isSuperAdmin && targetUser.organizationId !== req.user.organizationId)) {
            return res.status(404).json({ message: 'User not found or access denied.' });
        }

        const targetUserRole = await prisma.role.findUnique({ where: { id: targetUser.roleId } });
        if (targetUserRole.name === 'SUPER_ADMIN' && !isSuperAdmin) {
            return res.status(403).json({ message: 'Unauthorized: Cannot modify a platform-level administrator.' });
        }

        const targetRole = await prisma.role.findUnique({
            where: { id: parseInt(roleId) }
        });

        if (!targetRole) {
            return res.status(404).json({ message: 'Role not found.' });
        }

        if (targetRole.name === 'SUPER_ADMIN' && !isSuperAdmin) {
            return res.status(403).json({ message: 'Unauthorized: Cannot assign platform-level administrator role.' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: targetUser.id },
            data: { roleId: targetRole.id },
            include: { role: true }
        });

        res.json({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role.name,
            roleId: updatedUser.roleId
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    getPermissions,
    updateUserRole
};
