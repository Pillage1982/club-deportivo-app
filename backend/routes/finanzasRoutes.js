const express = require('express');
const router = express.Router();
const controller = require('../controllers/finanzasController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.listar
);

module.exports = router;