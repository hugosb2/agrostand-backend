/**
 * @file errorMiddleware.js
 * @description Middleware global de tratamento de erros para a aplicação Express.
 * No Express, middlewares de tratamento de erro devem receber exatamente 4 parâmetros: (err, req, res, next).
 * A presença do primeiro parâmetro 'err' indica ao Express que esta função deve ser invocada
 * apenas quando ocorrer um erro em alguma rota ou middleware anterior.
 */

// Importa a instância personalizada de logger (usando winston ou similar) para persistir e exibir logs formatados de erro.
const logger = require('../utils/logger');

/**
 * Função de middleware para interceptar e formatar respostas de erro enviadas ao cliente.
 * 
 * @param {Error|Object} err - O objeto de erro lançado ou passado via next(err).
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} next - Função callback do Express (obrigatório na assinatura, mesmo se não invocado).
 */
function errorMiddleware(err, req, res, next) {
  // Define o status HTTP padrão como 500 (Erro Interno do Servidor) caso nenhum status específico tenha sido fornecido.
  const status = err.status || 500;
  
  // Define a mensagem de erro padrão caso nenhuma mensagem descritiva tenha sido anexada ao erro.
  const message = err.message || 'Ocorreu um erro interno no servidor.';

  // Registra o erro utilizando o logger estruturado.
  // Grava informações contextuais essenciais, como método HTTP, URL acessada, endereço de IP e ID do usuário autenticado.
  logger.error(`Error during request to ${req.method} ${req.originalUrl}`, err, {
    status,
    ip: req.ip,
    userId: req.user ? req.user.id : null
  });

  // Retorna a resposta HTTP formatada em JSON com detalhes estruturados do erro.
  res.status(status).json({
    status: 'error',
    statusCode: status,
    message: message,
    // Em ambiente de desenvolvimento, inclui o stack trace completo (pilha de chamadas) para facilitar o debug.
    // Em produção, o stack trace é omitido (retorna undefined) por questões de segurança e privacidade do código.
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

// Exporta o middleware de erro para ser registrado no arquivo principal da aplicação (geralmente app.js ou server.js) como o último middleware.
module.exports = errorMiddleware;

