const axios = require('axios');

const PYTHON_ENGINE_URL = process.env.DATA_ENGINE_URL || 'http://localhost:8000';

const normalizePhone = (phone) => {
    if (!phone) return null;
    let digits = phone.toString().replace(/\D/g, '');

    // Reject numbers longer than 14 digits (E.164 standard is 15, but for us 15 is usually junk)
    if (digits.length > 14) return null;

    if (digits.length === 0) return null;

    if (digits.startsWith('05') && digits.length === 10) {
        digits = '971' + digits.substring(1);
    } else if (digits.length === 9 && digits.startsWith('5')) {
        digits = '971' + digits;
    }

    // Hard validity check
    if (digits.startsWith('971') && digits.length !== 12) return null;
    if (digits.length < 10) return null;

    if (/^(\d)\1+$/.test(digits) || digits.includes('0000000')) {
        return null;
    }
    return '+' + digits;
};

const validateEmail = (email) => {
    if (!email) return null;
    const cleaned = email.toString().replace(/\s+/g, '').toLowerCase();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(cleaned) ? cleaned : null;
};

const cleanContact = async (data) => {
    try {
        const response = await axios.post(`${PYTHON_ENGINE_URL}/clean-contact`, data, { timeout: 2000 });
        return response.data;
    } catch (error) {
        console.warn('Python Data Engine unreachable, falling back to local cleaning logic');
        const name = data.name?.toString().trim() || 'Unknown';
        const cleanedName = name.toLowerCase() === 'unknown' ? 'Unknown' : name;

        const rawPhone = data.phone?.toString().trim() || null;
        const rawEmail = data.email?.toString().trim() || null;

        const normalizedPhone = normalizePhone(rawPhone);
        const validatedEmail = validateEmail(rawEmail);

        let score = (cleanedName !== 'Unknown' && cleanedName.length > 2) ? 30 : -20;
        score += normalizedPhone ? 50 : -30;
        score += validatedEmail ? 40 : 0;
        score += data.city ? 10 : 0;

        return {
            name: cleanedName,
            phone: normalizedPhone,
            email: validatedEmail,
            raw_phone: rawPhone,
            raw_email: rawEmail,
            language: data.language?.toString().trim() || 'English',
            city: data.city?.toString().trim() || null,
            score: Math.max(0, Math.min(100, score))
        };
    }
};

const cleanBatch = async (contacts) => {
    try {
        const response = await axios.post(`${PYTHON_ENGINE_URL}/clean-batch`, contacts, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.warn('Python Data Engine unreachable, falling back to local batch cleaning');
        return Promise.all(contacts.map(c => cleanContact(c)));
    }
};

const cleanRow = async (row, mapping) => {
    const data = {
        name: row[mapping.name],
        phone: row[mapping.phone],
        email: row[mapping.email],
        company: row[mapping.company]
    };
    const cleaned = await cleanContact(data);
    return {
        ...cleaned,
        company: data.company || null,
        status: 'LEAD'
    };
};

module.exports = {
    normalizePhone,
    validateEmail,
    cleanContact,
    cleanBatch,
    cleanRow
};
