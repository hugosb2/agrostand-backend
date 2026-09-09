/**
 * @file server.js
 * @description Ponto de entrada (entrypoint) da aplicação.
 * Este script carrega as variáveis de ambiente, inicializa o banco de dados SQLite,
 * inicia o servidor HTTP do Express e configura o encerramento gracioso (graceful shutdown)
 * para evitar perda de dados e conexões pendentes em caso de parada.
 */

// Carrega as variáveis de ambiente definidas no arquivo '.env' para dentro do 'process.env'
require('dotenv').config();

// Importa o aplicativo Express pré-configurado no arquivo app.js
const app = require('./app');

// Importa a função responsável por conectar e inicializar as tabelas via Drizzle ORM
const { initializeDatabase, closeDatabase } = require('./db');

// Importa nossa ferramenta personalizada de logs
const logger = require('./utils/logger');

// Define a porta em que o servidor irá rodar.
// Primeiro tenta usar a porta informada nas variáveis de ambiente (.env), caso não exista, usa a porta padrão 3000
const PORT = process.env.PORT || 3000;

/**
 * Função principal assíncrona responsável por orquestrar a inicialização do sistema.
 * Usamos 'async/await' pois a conexão com o banco e inicialização de tabelas são operações de E/S assíncronas.
 */
async function startServer() {
  try {
    // 1. Inicializa o Banco de Dados SQLite (cria tabelas DDL e insere categorias iniciais se necessário)
    await initializeDatabase();

    // 2. Inicia o servidor HTTP do Express para ouvir as requisições na porta especificada
    const server = app.listen(PORT, () => {
      logger.info(`Servidor iniciado com sucesso na porta ${PORT}`, {
        port: PORT,
        env: process.env.NODE_ENV || 'development'
      });
    });

    /**
     * Função para encerramento gracioso (Graceful Shutdown).
     * Garante que conexões ativas sejam finalizadas e o banco fechado corretamente antes de parar o processo.
     * @param {string} signal - O sinal de encerramento recebido do SO (ex: SIGINT, SIGTERM)
     */
    const shutdown = (signal) => {
      logger.warn(`Sinal ${signal} recebido. Encerrando servidor graciosamente...`);
      
      // Fecha o servidor HTTP para novas conexões
      server.close(() => {
        logger.info('Servidor HTTP encerrado.');
        closeDatabase();
        // Encerra o processo do Node de forma limpa (código de saída 0 = sucesso)
        process.exit(0);
      });
    };

    // SIGTERM: Enviado por serviços de hospedagem (como Heroku, Docker ou Kubernetes) para solicitar encerramento do container
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // SIGINT: Sinal de interrupção (geralmente gerado ao apertar Ctrl+C no terminal local)
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    // Caso ocorra qualquer erro na inicialização (ex: falha ao conectar no SQLite)
    logger.error('Falha crítica ao iniciar o servidor', error);
    process.exit(1); // Encerra o processo indicando falha crítica (código de saída 1)
  }
}

// ==========================================
// Tratamento de Erros Globais (Segurança)
// ==========================================

// Captura exceções síncronas que não foram tratadas em nenhum bloco try/catch no código
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception (Exceção não capturada)', err);
  process.exit(1); // Finaliza para evitar que a aplicação fique em estado instável/corrompido
});

// Captura promessas assíncronas (promises) que foram rejeitadas e não tiveram um .catch() ou try/catch
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection (Rejeição de promessa não tratada)', new Error(String(reason)));
  process.exit(1); // Finaliza o processo por motivos de segurança e instabilidade
});

// Executa a função para ligar o servidor
startServer();
