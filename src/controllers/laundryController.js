const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const xlsx = require('xlsx');
const { cleanContact } = require('../services/dataCleaningService');

/**
 * Helper to check list existence and user access
 */
async function findListAndCheckAccess(listId, user) {
    const list = await prisma.contactList.findUnique({
        where: { id: parseInt(listId) }
    });

    if (!list) return { error: 'List not found', status: 404 };

    const { role, organizationId, id: userId } = user;
    const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';

    // Security check: Restricted roles (like EMPLOYEES or custom names) must own the list.
    // Admins must be in the same organization. SuperAdmin can see all.
    if (role !== 'SUPER_ADMIN') {
        if (list.organizationId !== organizationId) return { error: 'Forbidden', status: 403 };

        // If not an admin, they must be the creator
        if (role !== 'ORG_ADMIN' && list.createdById !== userId) {
            return { error: 'Forbidden', status: 403 };
        }
    }

    return { list };
}

/**
 * Get all contact lists based on role
 */
const getLists = async (req, res) => {
    const { role, organizationId, id: userId } = req.user;

    try {
        let where = {};
        const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';

        if (role === 'SUPER_ADMIN') {
            // Super Admin sees everything
            where = {};
        } else if (role === 'ORG_ADMIN') {
            // CEO sees all lists in company
            where = { organizationId };
        } else {
            // Restricted roles see only their private lists
            where = { createdById: userId, organizationId };
        }

        const lists = await prisma.contactList.findMany({
            where,
            include: {
                organization: { select: { name: true } },
                createdBy: { select: { name: true, email: true } },
                _count: { select: { contacts: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(lists);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get single list
 */
const getList = async (req, res) => {
    const { listId } = req.params;
    try {
        const { list, error, status } = await findListAndCheckAccess(listId, req.user);
        if (error) return res.status(status).json({ message: error });

        const fullList = await prisma.contactList.findUnique({
            where: { id: parseInt(listId) },
            include: {
                _count: { select: { contacts: true } },
                createdBy: { select: { name: true } }
            }
        });

        res.json(fullList);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new empty list
 */
const createList = async (req, res) => {
    const { name, description } = req.body;
    const { organizationId, id: userId, role } = req.user;

    // Optional: Restrict to Admins only if Agents shouldn't create lists
    // const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';
    // if (isRestricted) return res.status(403).json({ message: 'Only administrators can create lists' });

    try {
        const list = await prisma.contactList.create({
            data: {
                name,
                description,
                organizationId,
                createdById: userId
            }
        });
        res.status(201).json(list);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Get contacts for a specific list
 */
const getContacts = async (req, res) => {
    const { listId } = req.params;

    try {
        const { list, error, status } = await findListAndCheckAccess(listId, req.user);
        if (error) return res.status(status).json({ message: error });

        const contacts = await prisma.laundryContact.findMany({
            where: { listId: parseInt(listId) },
            orderBy: { createdAt: 'desc' }
        });

        res.json(contacts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Add a contact manually
 */
const addContact = async (req, res) => {
    const { listId } = req.params;
    const { name, phone, email, language, city } = req.body;

    try {
        const { list, error, status } = await findListAndCheckAccess(listId, req.user);
        if (error) return res.status(status).json({ message: error });

        // Initial clean
        const cleaned = await cleanContact({ name, phone, email, language, city });

        const hasValidChannel = cleaned.phone !== null || cleaned.email !== null;

        // Check for cross-list duplicates immediately
        const duplicateInfo = await checkCrossListMatch(req.user, parseInt(listId), cleaned);

        const contact = await prisma.laundryContact.create({
            data: {
                name: cleaned.name,
                phone: cleaned.phone || cleaned.raw_phone,
                email: cleaned.email || cleaned.raw_email,
                language: cleaned.language,
                city: cleaned.city,
                listId: parseInt(listId),
                score: cleaned.score || 0,
                isClean: (cleaned.score || 0) >= 70,
                isValid: cleaned.name !== 'Unknown' && hasValidChannel && !duplicateInfo,
                duplicateInfo: duplicateInfo
            }
        });
        res.status(201).json(contact);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Import contacts to a list with deduplication
 */
const importToList = async (req, res) => {
    const { listId } = req.params;
    const { mapping } = req.body;

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        const { list, error, status } = await findListAndCheckAccess(listId, req.user);
        if (error) return res.status(status).json({ message: error });

        const parsedMapping = JSON.parse(mapping);
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        // Get existing contacts to check for duplicates
        const existingContacts = await prisma.laundryContact.findMany({
            where: { listId: parseInt(listId) },
            select: { phone: true, email: true }
        });

        const existingPhones = new Set(existingContacts.map(c => c.phone).filter(Boolean));
        const existingEmails = new Set(existingContacts.map(c => c.email).filter(Boolean));

        const seenPhones = new Set();
        const seenEmails = new Set();

        const contactsToInsert = [];
        let duplicatesCount = 0;

        for (const row of data) {
            const raw = {
                name: row[parsedMapping.name],
                phone: row[parsedMapping.phone],
                email: row[parsedMapping.email],
                language: row[parsedMapping.language],
                city: row[parsedMapping.city]
            };

            const cleaned = await cleanContact(raw);

            // Deduplication check
            const isDuplicate =
                (cleaned.phone && (existingPhones.has(cleaned.phone) || seenPhones.has(cleaned.phone))) ||
                (cleaned.email && (existingEmails.has(cleaned.email) || seenEmails.has(cleaned.email)));

            if (isDuplicate) {
                duplicatesCount++;
                continue;
            }

            const hasValidChannel = cleaned.phone !== null || cleaned.email !== null;

            // Skip if no valid communication channel (no phone and no email)
            if (!hasValidChannel) continue;

            const duplicateInfo = await checkCrossListMatch(req.user, parseInt(listId), cleaned);

            contactsToInsert.push({
                name: cleaned.name,
                phone: cleaned.phone || cleaned.raw_phone,
                email: cleaned.email || cleaned.raw_email,
                language: cleaned.language,
                city: cleaned.city,
                listId: parseInt(listId),
                score: cleaned.score || 0,
                isClean: (cleaned.score || 0) >= 70,
                isValid: cleaned.name !== 'Unknown' && hasValidChannel && !duplicateInfo,
                duplicateInfo: duplicateInfo
            });
        }

        if (contactsToInsert.length > 0) {
            await prisma.laundryContact.createMany({
                data: contactsToInsert
            });
        }

        res.json({
            message: 'Import complete',
            count: contactsToInsert.length,
            duplicatesRemoved: duplicatesCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Helper to check for duplicates in other lists based on role
 */
async function checkCrossListMatch(user, currentListId, cleaned) {
    const { role, organizationId, id: userId } = user;
    const isRestricted = role === 'EMPLOYEE' || role === 'Sales Agent';

    let scopeWhere = {};
    if (role === 'SUPER_ADMIN') {
        scopeWhere = { listId: { not: currentListId } };
    } else if (role === 'ORG_ADMIN') {
        scopeWhere = { list: { organizationId }, listId: { not: currentListId } };
    } else {
        // Restricted role: Check across their own other lists
        scopeWhere = { list: { createdById: userId }, listId: { not: currentListId } };
    }

    const match = await prisma.laundryContact.findFirst({
        where: {
            AND: [
                scopeWhere,
                {
                    OR: [
                        cleaned.phone ? { phone: cleaned.phone } : undefined,
                        cleaned.email ? { email: cleaned.email } : undefined,
                    ].filter(Boolean)
                }
            ]
        },
        include: {
            list: {
                include: { createdBy: { select: { name: true } } }
            }
        }
    });

    if (match) {
        return `Cross-list Duplicate: Found in "${match.list.name}" (Owner: ${match.list.createdBy.name})`;
    }
    return null;
}

/**
 * Maintain/Clean all contacts in a list and remove duplicates
 */
const cleanList = async (req, res) => {
    const { listId } = req.params;
    const intListId = parseInt(listId);

    try {
        const { list, error, status } = await findListAndCheckAccess(listId, req.user);
        if (error) return res.status(status).json({ message: error });

        const contacts = await prisma.laundryContact.findMany({
            where: { listId: intListId },
            orderBy: { createdAt: 'desc' }
        });

        const seenPhones = new Set();
        const seenEmails = new Set();
        const toDelete = [];
        const toUpdate = [];

        for (const c of contacts) {
            const cleaned = await cleanContact({
                name: c.name,
                phone: c.phone,
                email: c.email,
                language: c.language,
                city: c.city
            });

            const hasValidChannel = cleaned.phone !== null || cleaned.email !== null;

            // 1. Internal Deduplication (Check within the current list)
            const isInternalDuplicate =
                (cleaned.phone && seenPhones.has(cleaned.phone)) ||
                (cleaned.email && seenEmails.has(cleaned.email));

            if (isInternalDuplicate) {
                toDelete.push(c.id);
                continue;
            }

            // Mark as seen for internal list dedupe
            if (cleaned.phone) seenPhones.add(cleaned.phone);
            if (cleaned.email) seenEmails.add(cleaned.email);

            // 2. External Deduplication (Cross-list checks based on Role/Ownership)
            const duplicateInfo = await checkCrossListMatch(req.user, intListId, cleaned);

            toUpdate.push(prisma.laundryContact.update({
                where: { id: c.id },
                data: {
                    name: cleaned.name,
                    phone: cleaned.phone || cleaned.raw_phone,
                    email: cleaned.email || cleaned.raw_email,
                    isClean: (cleaned.score || 0) >= 70,
                    isValid: cleaned.name !== 'Unknown' && hasValidChannel && !duplicateInfo,
                    score: cleaned.score || 0,
                    duplicateInfo: duplicateInfo
                }
            }));
        }

        // Execute updates and deletions
        if (toUpdate.length > 0) await Promise.all(toUpdate);
        if (toDelete.length > 0) {
            await prisma.$transaction([
                prisma.whatsAppMessageLog.deleteMany({
                    where: { recipientId: { in: toDelete } }
                }),
                prisma.laundryContact.deleteMany({
                    where: { id: { in: toDelete } }
                })
            ]);
        }

        res.json({
            message: 'List cleaned and deduplicated successfully',
            cleanedCount: toUpdate.length,
            duplicatesRemoved: toDelete.length
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Audit all contacts in a list (Non-destructive cleaning)
 * Flags duplicates but does NOT delete them.
 */
const auditList = async (req, res) => {
    const { listId } = req.params;
    const intListId = parseInt(listId);

    try {
        const { list, error, status } = await findListAndCheckAccess(listId, req.user);
        if (error) return res.status(status).json({ message: error });

        const contacts = await prisma.laundryContact.findMany({
            where: { listId: intListId },
            orderBy: { createdAt: 'desc' }
        });

        const seenPhones = new Set();
        const seenEmails = new Set();
        const toUpdate = [];

        for (const c of contacts) {
            const cleaned = await cleanContact({
                name: c.name,
                phone: c.phone,
                email: c.email,
                language: c.language,
                city: c.city
            });

            const hasValidChannel = cleaned.phone !== null || cleaned.email !== null;

            // 1. Internal Deduplication Check
            let duplicateInfo = null;
            const isInternalDuplicate =
                (cleaned.phone && seenPhones.has(cleaned.phone)) ||
                (cleaned.email && seenEmails.has(cleaned.email));

            if (isInternalDuplicate) {
                duplicateInfo = 'Internal Duplicate (Found in this list)';
            }

            // Mark as seen for internal list dedupe (even if it is a duplicate, we keep tracking)
            if (cleaned.phone) seenPhones.add(cleaned.phone);
            if (cleaned.email) seenEmails.add(cleaned.email);

            // 2. External Deduplication (Only if not already an internal duplicate)
            if (!duplicateInfo) {
                duplicateInfo = await checkCrossListMatch(req.user, intListId, cleaned);
            }

            toUpdate.push(prisma.laundryContact.update({
                where: { id: c.id },
                data: {
                    name: cleaned.name,
                    phone: cleaned.phone || cleaned.raw_phone,
                    email: cleaned.email || cleaned.raw_email,
                    isClean: (cleaned.score || 0) >= 70,
                    isValid: cleaned.name !== 'Unknown' && hasValidChannel && !duplicateInfo,
                    score: cleaned.score || 0,
                    duplicateInfo: duplicateInfo
                }
            }));
        }

        if (toUpdate.length > 0) await Promise.all(toUpdate);

        res.json({
            message: 'Audit complete. All records examined and flagged.',
            auditedCount: toUpdate.length
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Delete a list and its contacts
 */
const deleteList = async (req, res) => {
    const { listId } = req.params;
    try {
        const { list, error, status } = await findListAndCheckAccess(listId, req.user);
        if (error) return res.status(status).json({ message: error });

        const intId = parseInt(listId);

        await prisma.$transaction([
            // 1. Delete all logs for contacts in this list
            prisma.whatsAppMessageLog.deleteMany({
                where: { recipient: { listId: intId } }
            }),
            // 2. Delete all contacts in this list (Cascade handle in schema should usually do this, but being safe)
            prisma.laundryContact.deleteMany({
                where: { listId: intId }
            }),
            // 3. Delete the list itself
            prisma.contactList.delete({
                where: { id: intId }
            })
        ]);

        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Delete a single contact from a list
 */
const deleteContact = async (req, res) => {
    const { listId, contactId } = req.params;

    try {
        const { list, error, status } = await findListAndCheckAccess(listId, req.user);
        if (error) return res.status(status).json({ message: error });

        const contact = await prisma.laundryContact.findUnique({
            where: { id: parseInt(contactId) }
        });

        if (!contact) return res.status(404).json({ message: 'Contact not found' });
        if (contact.listId !== parseInt(listId)) return res.status(400).json({ message: 'Contact does not belong to this list' });

        await prisma.$transaction([
            prisma.whatsAppMessageLog.deleteMany({
                where: { recipientId: parseInt(contactId) }
            }),
            prisma.laundryContact.delete({
                where: { id: parseInt(contactId) }
            })
        ]);

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Bulk delete invalid contacts from a list
 */
const bulkDeleteInvalid = async (req, res) => {
    const { listId } = req.params;
    try {
        const { list, error, status } = await findListAndCheckAccess(listId, req.user);
        if (error) return res.status(status).json({ message: error });

        const intListId = parseInt(listId);

        // Get IDs of invalid contacts first
        const invalidContacts = await prisma.laundryContact.findMany({
            where: { listId: intListId, isValid: false },
            select: { id: true }
        });

        const invalidIds = invalidContacts.map(c => c.id);

        if (invalidIds.length > 0) {
            await prisma.$transaction([
                prisma.whatsAppMessageLog.deleteMany({
                    where: { recipientId: { in: invalidIds } }
                }),
                prisma.laundryContact.deleteMany({
                    where: { id: { in: invalidIds } }
                })
            ]);
        }

        res.json({
            message: 'Invalid contacts deleted successfully',
            count: invalidIds.length
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getLists,
    getList,
    createList,
    getContacts,
    addContact,
    importToList,
    cleanList,
    deleteList,
    deleteContact,
    bulkDeleteInvalid,
    auditList
};
