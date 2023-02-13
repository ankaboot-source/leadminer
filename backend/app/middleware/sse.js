const { SSE } = require('express-sse');

const sse = new SSE();
const sseHeaders = (_, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    next();
};

module.exports = { sse ,sseHeaders };
