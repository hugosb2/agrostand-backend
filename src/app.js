/**
 * @file app.js
 * @description Arquivo de inicialização e configuração do aplicativo Express.
 * Aqui configuramos todos os middlewares globais, rotas e manipuladores de erro.
 * Um junior dev deve entender este arquivo como o "coração" da configuração do servidor.
 */

// Importa o framework Express para criação de rotas e servidores HTTP
const express = require('express');

//BANKAAAAAAIIIIII


// Importa o CORS (Cross-Origin Resource Sharing), que permite que o frontend (em outra porta/domínio) acesse a API
const cors = require('cors');

// Importa o módulo 'path' nativo do Node.js, usado para trabalhar com caminhos de arquivos e diretórios
const path = require('path');

// Importa as rotas unificadas da API definidas na pasta de rotas
const apiRoutes = require('./routes');

// Importa o middleware personalizado para registrar logs de requisições HTTP recebidas
const loggerMiddleware = require('./middlewares/loggerMiddleware');

// Importa o middleware centralizador que trata erros que acontecem durante o fluxo das requisições
const errorMiddleware = require('./middlewares/errorMiddleware');

// Cria uma instância do aplicativo Express
const app = express();

// ==========================================
// 1. Middlewares Globais de Configuração
// ==========================================

// Ativa o CORS para permitir requisições de outras origens (como um app React ou Vue)
app.use(cors());

// Permite que o Express leia e interprete requisições que enviam dados no formato JSON (no corpo/body)
app.use(express.json());

// Permite que o Express leia dados enviados via formulários HTML (URL Encoded)
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 2. Middlewares Customizados e Arquivos Estáticos
// ==========================================

// Aplica o middleware de log para todas as requisições, ajudando a monitorar quem acessa o quê (RS06)
app.use(loggerMiddleware);

// Define que arquivos dentro da pasta 'public/uploads' podem ser acessados diretamente via URL HTTP (Ex: http://localhost:3000/uploads/imagem.jpg)
// O 'express.static' expõe a pasta publicamente, o que é ideal para buscar as imagens de anúncios (RS02)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ==========================================
// 3. Definição de Rotas
// ==========================================

// Todas as rotas da API começarão com o prefixo '/api' (Ex: /api/users, /api/ads)
app.use('/api', apiRoutes);

// Rota raiz (welcome route) para verificar se a API está online e dar as boas-vindas
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Bem-vindo ao Backend do Agrostand API',
    version: '1.0.0'
  });
});

// Endpoint de Health Check (verificação de saúde da aplicação)
// Usado por sistemas de monitoramento para saber se o servidor está ativo (UP)
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString() // Retorna a data/hora atual no padrão ISO
  });
});

// ==========================================
// 4. Tratamento de Erros
// ==========================================

// Middleware centralizado de tratamento de erros. Deve ser SEMPRE o último a ser registrado
// Qualquer erro gerado nas rotas ou middlewares anteriores será capturado aqui (RNF12, RS06)
app.use(errorMiddleware);

// Exporta o aplicativo Express configurado para ser iniciado no arquivo server.js
module.exports = app;
