const stream = require('../controllers/stream.controller');
const router = require('express').Router();

router.get('/mine/:userid/:id/progress/', stream.streamProgress);

module.exports = router;
