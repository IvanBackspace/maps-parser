const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

router.post('/run', sessionController.runParser);
router.get('/status/:sessionId', sessionController.getStatus);
router.get('/download-csv/:sessionId', sessionController.downloadCsv);
router.get('/sessions', sessionController.listSessions);
router.get('/active-count', sessionController.getActiveCount);

module.exports = router;