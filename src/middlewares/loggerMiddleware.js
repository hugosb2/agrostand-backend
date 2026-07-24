/**
 * @file loggerMiddleware.js
 * @description Middleware para registrar logs de auditoria de cada requisição HTTP recebida pela aplicação.
 * Utiliza o logger estruturado do sistema para salvar metadados como método, URL, status code, tempo de resposta,
 * IP do cliente, user-agent e ID do usuário autenticado (se disponível).
 */

// Importa a instância personalizada do logger da aplicação.
const logger = require('../utils/logger');

/**
 * Middleware que mede e registra o tempo de ciclo de vida completo de cada requisição HTTP.
 * 
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} next - Função callback do Express para seguir para o próximo middleware.
 */
function loggerMiddleware(req, res, next) {
  // Captura o momento inicial de processamento da requisição usando process.hrtime().
  // O process.hrtime() retorna um array [segundos, nanossegundos]. É imune a ajustes e desvios
  // no relógio do sistema, sendo ideal para medir intervalos precisos de tempo (benchmarking).
  const startTime = process.hrtime();

  // Registra um event listener no objeto de resposta (res).
  // O evento 'finish' é disparado pelo Node.js assim que os cabeçalhos e o corpo da resposta
  // foram completamente enviados ao cliente de rede (fim da resposta HTTP).
  res.on('finish', () => {
    // Calcula o tempo decorrido desde o início da requisição até a sua finalização.
    const diff = process.hrtime(startTime);
    
    // Converte a diferença de tempo de segundos/nanossegundos para milissegundos.
    // 1e9 nanossegundos = 1 segundo, 1e6 nanossegundos = 1 milissegundo.
    const timeInMs = (diff[0] * 1e9 + diff[1]) / 1e6; 

    // Registra uma linha de log informativa estruturada com dados cruciais da requisição e da resposta.
    logger.info(`HTTP Request: ${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode, // Código de status HTTP final da resposta (ex: 200, 201, 400, 500)
      responseTimeMs: parseFloat(timeInMs.toFixed(2)), // Tempo formatado com duas casas decimais
      ip: req.ip, // IP de origem do cliente
      userAgent: req.headers['user-agent'], // Informações do navegador/cliente que fez a requisição
      userId: req.user ? req.user.id : null // ID do usuário autenticado (se o authMiddleware tiver rodado antes)
    });
  });

  // Invoca a função next() para que a requisição continue seu fluxo pelas rotas normais
  // enquanto o evento 'finish' aguarda a conclusão da resposta em segundo plano.
  next();
}

// Exporta o middleware de log para ser utilizado na configuração geral da aplicação (geralmente anexado logo no início).
module.exports = loggerMiddleware;

