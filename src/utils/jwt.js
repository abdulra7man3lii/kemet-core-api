const jwt = require('jsonwebtoken');

const generateToken = (id, orgId, role) => {
    return jwt.sign({ id, orgId, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
