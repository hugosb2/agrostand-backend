# Agrostand Backend 🌾

> **Agrostand** é um marketplace agrícola projetado para aproximar produtores rurais (anunciantes) e compradores de forma direta e sem intermediários, permitindo negociações diretas por canais externos (WhatsApp).

Este repositório contém a **API RESTful** do sistema Agrostand, desenvolvida em **Node.js** com **Express** e **SQLite**. A arquitetura do projeto segue princípios de **Clean Architecture** e **DDD (Domain-Driven Design)**, separando a lógica de negócios das tecnologias de persistência.

---

## 🚀 Tecnologias e Bibliotecas

O projeto utiliza um conjunto de tecnologias modernas e robustas para garantir performance e segurança:

* **Core**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) (Framework HTTP)
* **Banco de Dados**: [SQLite](https://www.sqlite.org/) (com drivers `sqlite` e `sqlite3` para persistência local veloz)
* **Segurança**:
  * Criptografia de senhas usando [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
  * Autenticação e autorização via [JSON Web Tokens (JWT)](https://jwt.io/)
* **Envio de Mídias**: [Multer](https://github.com/expressjs/multer) para upload e armazenamento local de imagens em disco
* **E-mails transacionais**: [Nodemailer](https://nodemailer.com/) para recuperação de senhas por SMTP (com suporte a Gmail e Ethereal Mail)
* **Auditoria e Logs**: Log estruturado em JSON gravado localmente

---

## 📁 Estrutura do Projeto (Arquitetura)

A base de código está organizada em português para facilitar o entendimento de desenvolvedores juniores, seguindo a divisão de responsabilidades:

```bash
src/
├── config/             # Configurações do banco SQLite (bancoDeDados.js) e Multer (multer.js)
├── controllers/        # Controladores HTTP (tratam requisições, validam parâmetros e enviam respostas JSON)
├── domain/             # Entidades ricas de Domínio (Usuario, Anuncio, etc., com encapsulamento e regras de negócio)
├── middlewares/        # Middlewares do Express (Validação de JWT, Logs e Captura Global de Erros)
├── models/             # Repositórios (Data Access Layer) contendo queries SQL cruas para o SQLite
├── routes/             # Definição e agrupamento de endpoints RESTful
├── services/           # Serviços auxiliares de infraestrutura (como gerenciamento de arquivos físicos)
├── utils/              # Funções utilitárias (validadores regex, formatador do WhatsApp e envio de e-mails)
├── app.js              # Inicialização e configuração de middlewares globais do Express
└── server.js           # Ponto de entrada (Entrypoint), escuta de portas e encerramento gracioso
```

---

## ⚡ Como Rodar o Projeto

### Pré-requisitos
* Node.js instalado (versão 18 ou superior)
* Gerenciador de pacotes NPM (instalado por padrão com o Node)

### 1. Clonar e instalar as dependências
```bash
git clone https://github.com/seu-usuario/agrostand-backend.git
cd agrostand-backend
npm install
```

### 2. Configurar as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto (use o arquivo `.env.example` como base):
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=sua_chave_secreta_jwt_aqui

# Configurações do SMTP de E-mail (Gmail Exemplo)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app-do-google
SMTP_FROM=seu-email@gmail.com
```
> 💡 *Nota: Se as variáveis de SMTP não forem preenchidas, o sistema automaticamente gerará uma conta de testes gratuita no **Ethereal Mail** e exibirá o link de visualização do e-mail no console do terminal, ou imprimirá o código de recuperação diretamente no terminal (fallback).*

### 3. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
O servidor será iniciado na porta especificada (padrão `3000`). Você verá a mensagem:
`Servidor iniciado com sucesso na porta 3000`

---

## 🔗 Endpoints da API (Visão Geral)

### Autenticação & Usuários
* `POST /api/auth/register` - Cadastro de novos usuários (com validação de senha forte e formato de dados)
* `POST /api/auth/login` - Login que retorna o token de acesso JWT
* `POST /api/auth/recovery-request` - Solicita código de 6 dígitos para recuperação de senha
* `POST /api/auth/reset-password` - Redefine a senha utilizando o código gerado
* `GET /api/users/profile` - Retorna o perfil do usuário logado (requer token JWT)
* `PUT /api/users/profile` - Atualiza informações cadastrais
* `PUT /api/users/password` - Altera a senha do usuário autenticado
* `DELETE /api/users/account` - Exclui a conta em conformidade com as diretrizes da **LGPD** (exclusão em cascata)

### Endereços
* `GET /api/addresses` - Lista os endereços cadastrados do usuário logado
* `POST /api/addresses` - Cadastra um novo endereço (Urbano ou Rural)
* `PUT /api/addresses/:id` - Atualiza dados de um endereço existente (apenas se pertencer ao usuário)
* `DELETE /api/addresses/:id` - Remove um endereço cadastrado

### Categorias
* `GET /api/categories` - Lista as categorias de produtos agrícolas do catálogo

### Anúncios (Marketplace)
* `GET /api/ads` - Lista anúncios ativos (com paginação e filtros por categoria ou termo de busca)
* `GET /api/ads/:id` - Visualiza os detalhes completos de um anúncio específico
* `POST /api/ads` - Cria um novo anúncio (requer upload de imagem principal e suporta múltiplas imagens secundárias)
* `PUT /api/ads/:id` - Edita informações do anúncio (apenas se pertencer ao anunciante)
* `DELETE /api/ads/:id` - Envia um anúncio para a lixeira (*soft delete*)
* `POST /api/ads/:id/restore` - Restaura um anúncio que estava na lixeira
* `GET /api/ads/:id/whatsapp` - Retorna a URL de redirecionamento dinâmico do **WhatsApp Click-to-Chat** para contatar o vendedor

---

## 🔒 Boas Práticas e Segurança Implementadas
1. **Compliance de Privacidade (LGPD)**: Rotinas automatizadas de exclusão definitiva de dados agregados ao deletar contas de usuários.
2. **Prevenção contra SQL Injection**: Uso de consultas parametrizadas em todas as queries com o SQLite.
3. **Encerramento Gracioso (Graceful Shutdown)**: Captura de sinais `SIGINT` (Ctrl+C) e `SIGTERM` para fechar conexões de banco de dados e servidores sem corromper transações.
4. **Tratamento de Exceções Globais**: Captura e registro seguro de `uncaughtException` e `unhandledRejection` para evitar instabilidade da aplicação.
