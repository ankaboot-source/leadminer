const stream = require('../controllers/stream.controller');
const router = require('express').Router();

router.get('/progress', stream.streamProgress);

module.exports = router;