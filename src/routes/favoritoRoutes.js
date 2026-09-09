/**
 * @file favoritoRoutes.js
 * @description Rotas de favoritos (UC10/UC11). Todas exigem JWT (RN17: um
 * cliente não autenticado não registra favorito).
 */

const express = require('express');

const FavoritoController = require('../controllers/FavoritoController');

const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware); // todas as rotas de favoritos exigem autenticação

/**
 * Rota: POST /toggle
 * Descrição: Liga/desliga o favorito do anúncio (coração).
 * Mapeamento: FavoritoService.toggle
 */
router.post('/toggle', FavoritoController.toggle);

/**
 * Rota: GET /
 * Descrição: Lista os favoritos do usuário autenticado (recentes primeiro).
 * Mapeamento: FavoritoService.list
 */
router.get('/', FavoritoController.list);

/**
 * Rota: DELETE /:id
 * Descrição: Remove um favorito pela lista, com validação de propriedade.
 * Mapeamento: FavoritoService.remove
 */
router.delete('/:id', FavoritoController.remove);

module.exports = router;
