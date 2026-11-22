'use strict';

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('node:path');

const memberAuthRoutes = require('./src/routes/member-auth.routes');
const memberRoutes = require('./src/routes/member.routes');
const feedRoutes = require('./src/routes/feed.routes');
const cardRoutes = require('./src/routes/card.routes');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(helmet());

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({
    extended: false,
    limit: '10kb'
}));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        project: 'SHINOBI VERSE',
        version: '1.0.0'
    });
});

app.use('/api/auth', memberAuthRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/cards', cardRoutes);

app.use((req, res) => {
    res.status(404).json({
        error: 'Rota nao encontrada'
    });
});

app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]:', err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        error: 'Erro interno do servidor'
    });
});

const http = require('node:http');
const { attachChatSocket } = require('./src/socket/chat.socket');
const httpServer = http.createServer(app);
attachChatSocket(httpServer);
httpServer.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('================================');
    console.log('       SHINOBI VERSE');
    console.log('       SYSTEM ONLINE');
    console.log('================================');
    console.log(`Local: http://127.0.0.1:${PORT}`);
    console.log('API:   /api/auth');
    console.log('API:   /api/members');
    console.log('API:   /api/feed');
    console.log('API:   /api/cards');
    console.log('================================');
});
