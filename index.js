const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// BigInt serialization fix for JSON.stringify
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const app = express();
const port = process.env.PORT || 4000;

const authRoutes = require('./src/routes/authRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const interactionRoutes = require('./src/routes/interactionRoutes');
const internalNoteRoutes = require('./src/routes/internalNoteRoutes');
const importRoutes = require('./src/routes/importRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const roleRoutes = require('./src/routes/roleRoutes');
const laundryRoutes = require('./src/routes/laundryRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const storageRoutes = require('./src/routes/storageRoutes');
const calendarRoutes = require('./src/routes/calendarRoutes');
const pipelineRoutes = require('./src/routes/pipelineRoutes');

const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');
const logger = require('./src/middleware/loggerMiddleware');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

app.use(helmet());
app.use(limiter);
app.use(logger);

const allowedOrigins = [
    'http://localhost:3000',
    'https://mazboot.digital',
    'http://mazboot.digital'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/internal-notes', internalNoteRoutes);
app.use('/api/import', importRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/laundry', laundryRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/pipeline', pipelineRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Hello from KEMET Core API' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Core API listening on port ${port}`);
});
