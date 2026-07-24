/**
 * @file logger.js
 * @description Utilitário de logging estruturado para o sistema Agrostand.
 * Este utilitário fornece métodos centralizados para registrar eventos da aplicação,
 * incluindo informações gerais (INFO), alertas (WARN), falhas de execução (ERROR) e logs
 * de auditoria de segurança/negócio (AUDIT). 
 * 
 * Papel no fluxo de negócios:
 * - O registro de logs estruturado ajuda desenvolvedores e administradores a entender o comportamento 
 *   do sistema em tempo real, depurar erros de produção e manter uma trilha de auditoria para ações
 *   sensíveis dos usuários (como criação de produtos de alto valor ou redefinições de senha).
 * - Os logs de auditoria (AUDIT) e ações críticas são salvos de forma persistente em um arquivo de texto local
 *   (`logs/audit.log`) no servidor para análise de segurança posterior (compliance).
 */

const fs = require('fs');
const path = require('path');

// Define o diretório onde os arquivos físicos de log serão salvos (raiz-do-projeto/logs)
const logDir = path.resolve(__dirname, '../../logs');

// Cria o diretório de logs caso ele ainda não exista no servidor (usa a flag recursive para evitar erros de caminhos pais)
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define o caminho absoluto para o arquivo que armazenará os logs de auditoria
const auditLogPath = path.join(logDir, 'audit.log');

/**
 * Função interna centralizada de gravação e exibição de logs.
 * Formata os dados de log em formato JSON para fácil processamento por sistemas de monitoramento modernos (como Kibana/Grafana).
 * 
 * @param {string} level - O nível do log (INFO, WARN, ERROR, AUDIT).
 * @param {string} message - A mensagem descritiva do evento.
 * @param {Object} meta - Metadados adicionais úteis sobre o contexto do log (ex: userId, ip, productId, etc.).
 */
function log(level, message, meta = {}) {
  // Constrói a estrutura do log de forma uniforme
  const logEntry = {
    timestamp: new Date().toISOString(), // Marca de tempo em formato ISO 8601 (UTC)
    level,                               // Nível do log
    message,                             // Mensagem
    ...meta                              // Mescla quaisquer dados adicionais fornecidos
  };

  // Transforma o objeto do log em uma string JSON de linha única
  const jsonLog = JSON.stringify(logEntry);
  
  // Saída padrão para o terminal do servidor
  if (level === 'ERROR') {
    // Erros graves vão para a saída padrão de erros (stderr)
    console.error(jsonLog);
  } else {
    // Logs normais e avisos vão para a saída padrão (stdout)
    console.log(jsonLog);
  }

  // Verifica se o log é de Auditoria de Segurança ou se foi sinalizado como Ação Crítica.
  // Caso seja, grava fisicamente e de forma síncrona no arquivo de logs de auditoria.
  if (level === 'AUDIT' || meta.isCritical) {
    fs.appendFileSync(auditLogPath, jsonLog + '\n', 'utf8');
  }
}

// Exportação dos métodos públicos simplificados para os desenvolvedores utilizarem nos controllers e middlewares
module.exports = {
  // Informação geral sobre operações bem-sucedidas do sistema (ex: conexão com banco de dados)
  info: (message, meta) => log('INFO', message, meta),
  
  // Alerta sobre situações não-fatais que exigem atenção (ex: credenciais SMTP ausentes, código incorreto digitado)
  warn: (message, meta) => log('WARN', message, meta),
  
  // Registrar falhas de execução e exceções capturadas (ex: erro na query SQL).
  // Extrai o stack trace e a mensagem de erro do objeto Error padrão do JavaScript.
  error: (message, errorObj, meta = {}) => {
    const errorMeta = {
      errorMessage: errorObj.message,
      errorStack: errorObj.stack,
      ...meta
    };
    log('ERROR', message, errorMeta);
  },
  
  // Registro de Auditoria de segurança/negócio. Exemplo: login efetuado, perfil deletado, etc.
  // Sempre marca o log como crítico para persistência imediata no arquivo audit.log.
  audit: (message, meta) => log('AUDIT', message, { ...meta, isCritical: true })
};
