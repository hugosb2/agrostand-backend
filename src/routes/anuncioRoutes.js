/**
 * @file adRoutes.js
 * @description Rotas de gerenciamento de anúncios de produtos (adverts/products).
 * Este arquivo define endpoints públicos e privados para a manipulação de anúncios no marketplace,
 * integrando middlewares para upload de imagens (Multer) e autenticação de tokens JWT.
 */

// Importa o framework Express para habilitar as funções de roteamento.
const express = require('express');

// Importa o controlador AnuncioController para processar as requisições vinculadas aos anúncios.
const AnuncioController = require('../controllers/AnuncioController');

// Importa o middleware de autenticação JWT para proteger rotas administrativas e pessoais.
const authMiddleware = require('../middlewares/authMiddleware');

// Importa a instância pré-configurada do Multer para lidar com upload de mídias/arquivos de imagem.
const upload = require('../config/multer');

// Cria o roteador do Express focado em anúncios.
const router = express.Router();

/**
 * Configuração dos campos de upload permitidos na requisição HTTP.
 * O método upload.fields recebe uma lista de objetos contendo o nome do campo (name)
 * enviado no form-data e a quantidade máxima (maxCount) de arquivos aceitos para aquele campo.
 * - 'imagemPrincipal': Aceita apenas 1 arquivo contendo a imagem de destaque do anúncio.
 * - 'imagensSecundarias': Aceita até 5 arquivos contendo a galeria de imagens do anúncio.
 */
const uploadFields = upload.fields([
  { name: 'imagemPrincipal', maxCount: 1 },
  { name: 'imagensSecundarias', maxCount: 5 }
]);

// ==========================================
// ROTAS PÚBLICAS (Acessíveis sem Token JWT)
// ==========================================

/**
 * Rota: GET /
 * Descrição: Retorna uma lista de anúncios ativos com suporte a paginação e filtros de busca.
 * Mapeamento: AnuncioController.list
 */
router.get('/', AnuncioController.list);

/**
 * Rota: POST /cleanup
 * Descrição: Aciona manualmente ou via tarefa agendada (CRON job) a limpeza de registros expirados ou temporários.
 * Mapeamento: AnuncioController.triggerCleanup
 */
router.post('/cleanup', AnuncioController.triggerCleanup); // Pode ser acionado por tarefas recorrentes CRON

/**
 * Rota: GET /:id
 * Descrição: Obtém detalhes detalhados de um anúncio específico com base no ID fornecido na URL.
 * Mapeamento: AnuncioController.get
 */
router.get('/:id', AnuncioController.get);

// ==========================================
// ROTAS PROTEGIDAS (Exigem Token JWT Válido)
// ==========================================

// Aplica o middleware de autenticação para todas as rotas registradas após este ponto.
router.use(authMiddleware);

/**
 * Rota: GET /me/products
 * Descrição: Recupera a lista de produtos/anúncios pertencentes especificamente ao usuário autenticado.
 * Mapeamento: AnuncioController.myProducts
 */
router.get('/me/products', AnuncioController.myProducts);

/**
 * Rota: POST /
 * Descrição: Cria um novo anúncio no marketplace.
 * Middlewares associados: 
 *   - 'uploadFields': Processa os campos de upload de imagem antes de repassar os dados para o controlador.
 * Mapeamento: AnuncioController.create
 */
router.post('/', uploadFields, AnuncioController.create);

/**
 * Rota: PUT /:id
 * Descrição: Atualiza os dados ou substitui as imagens de um anúncio existente (identificado por :id).
 * Middlewares associados:
 *   - 'uploadFields': Permite atualizar as imagens principais ou adicionais do anúncio.
 * Mapeamento: AnuncioController.update
 */
router.put('/:id', uploadFields, AnuncioController.update);

/**
 * Rota: DELETE /:id
 * Descrição: Remove ou desativa um anúncio existente (normalmente realiza um soft-delete).
 * Mapeamento: AnuncioController.delete
 */
router.delete('/:id', AnuncioController.delete);

/**
 * Rota: POST /:id/restore
 * Descrição: Restaura um anúncio previamente removido (soft-deleted) tornando-o visível novamente.
 * Mapeamento: AnuncioController.restore
 */
router.post('/:id/restore', AnuncioController.restore);

// Exporta o roteador configurado para ser incorporado no index de rotas.
module.exports = router;

