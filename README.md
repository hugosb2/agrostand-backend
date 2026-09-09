# Agrostand Backend 🌾

> **Agrostand** é um marketplace agrícola projetado para aproximar produtores rurais (anunciantes) e compradores de forma direta e sem intermediários, permitindo negociações diretas por canais externos (WhatsApp).

Este repositório contém a **API RESTful** do sistema Agrostand, desenvolvida em **Node.js** com **Express** e **SQLite**. A arquitetura do projeto segue princípios de **Clean Architecture** e **DDD (Domain-Driven Design)**, separando a lógica de negócios das tecnologias de persistência.

---

## 🚀 Tecnologias e Bibliotecas

O projeto utiliza um conjunto de tecnologias modernas e robustas para garantir performance e segurança:

* **Core**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) (Framework HTTP)
* **Banco de Dados**: [SQLite](https://www.sqlite.org/) via [Drizzle ORM](https://orm.drizzle.team/) (driver `better-sqlite3`, migrations com `drizzle-kit`)
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
├── config/             # Compat de banco (shim p/ `src/db`) e Multer (multer.js)
├── controllers/        # Thin adapters HTTP (extraem entrada, chamam services, montam o envelope; sem regra de negócio)
├── dao/                # DAOs via Drizzle query builder (sem SQL cru; aceitam `tx` p/ transações)
├── db/                 # Drizzle ORM: schema.js (tabelas), index.js (conexão better-sqlite3, DDL idempotente e seed)
├── domain/             # Model: entidades de domínio (Usuario, Cliente, Anunciante, Anuncio, Produto, ...) usadas pelos services p/ regras e transições de estado; factories.js monta entidades a partir das linhas do banco
├── errors/             # Exceções de negócio (AppError 400/401/403/404) lançadas pelos services e traduzidas pelo errorMiddleware
├── middlewares/        # Middlewares do Express (Validação de JWT, Logs e Captura Global de Erros)
├── routes/             # Definição e agrupamento de endpoints RESTful
├── services/           # Services: orquestram domínio + DAOs + transações (lógica de negócio; sem HTTP)
├── utils/              # Funções utilitárias (validadores regex, formatador do WhatsApp e envio de e-mails)
├── app.js              # Inicialização e configuração de middlewares globais do Express
└── server.js           # Ponto de entrada (Entrypoint), escuta de portas e encerramento gracioso
```

Migrations versionadas do Drizzle ficam em `drizzle/` (geradas com `npm run db:generate`).

> **Transações (better-sqlite3 é síncrono):** todo I/O assíncrono (bcrypt, upload/e-mail) ocorre
> fora de `db.transaction((tx) => ...)`. Dentro da transação, os DAOs são chamados de forma
> síncrona com o cliente `tx` (ex: `UsuarioDAO.create(dados, tx)`).

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

### 4. Migrations do banco (Drizzle Kit)
```bash
npm run db:generate  # gera SQL em ./drizzle a partir de src/db/schema.js
npm run db:push      # aplica o schema direto no SQLite local (dev)
npm run db:studio    # abre o Drizzle Studio
```
> O boot (`initializeDatabase`) cria tabelas com `IF NOT EXISTS` e popula as categorias padrão,
> reaproveitando o `database.sqlite` legado sem perda de dados.

### 5. Camadas (estilo Java/Spring)
```text
HTTP → Controller (thin) → Service (regras + transação) → Domain (entidades) + DAO (Drizzle)
```
Erros de negócio (`src/errors/AppError`) são lançados pelos services e traduzidos
pelo `errorMiddleware` para o envelope `{status:'error', message}` com o HTTP code.

### 6. Testes (runner nativo do Node, sem dependências)
```bash
npm test                # unitários + integração
npm run test:unit        # test/unit — domínio, validadores, erros
npm run test:integration # test/integration — HTTP ponta a ponta
```
Cobrem os casos de uso da spec: **UC1/UC12** cadastro e login (`auth.test.js`),
**UC2** anunciar (`anunciar-produto.test.js`: endereço existente/novo, matriz de
validação, imagem inválida, atomicidade), **UC3** visualizar (`visualizar-anuncio.test.js`),
**UC4** contato WhatsApp (`contatar-vendedor.test.js` + unit `whatsapp.test.js`),
**UC5** pesquisar (`pesquisar-produtos.test.js`),
**UC6** endereços (`gerenciar-enderecos.test.js`: zonas, RN18, múltiplos),
**UC7** gerenciar produtos
(`gerenciar-produtos.test.js`: painel por status, edição completa com troca de arquivos,
RN15, purga +30 dias), **UC8** dados pessoais (`gerenciar-dados.test.js`),
**UC9** navegação (`navegar-anuncios.test.js`: vitrine, paginação,
filtro por categoria), **UC14** exclusão LGPD em cascata (`excluir-conta.test.js`, inclui RN20) e
**UC10/UC11** favoritos (`favoritos.test.js`: toggle, RN17, indisponíveis, RN20),
**UC12 alt. 2 + UC13** segurança de sessão (`seguranca.test.js`: bloqueio RN19,
logout com denylist; unit `bloqueio.test.js`).
recuperação de senha (`recuperacao.test.js`, com e-mail stubado).
Sem cobertura (divergências spec × implementação): username/RN21, foto de perfil,
RN18 rural "nome da propriedade" e confirmação por senha na exclusão — a API não
tem esses campos/fluxos. A integração sobe o app em porta
efêmera com SQLite temporário e uploads isolados por arquivo (via `UPLOAD_DIR`) —
não toca no `database.sqlite` nem em `public/uploads` de dev.

---

## 🔗 Endpoints da API (Visão Geral)

### Autenticação & Usuários
* `POST /api/auth/register` - Cadastro de novos usuários (com validação de senha forte e formato de dados)
* `POST /api/auth/login` - Login que retorna o token de acesso JWT (bloqueio temporário após 3 falhas — RN19)
* `POST /api/auth/logout` - Encerra a sessão revogando o JWT atual (requer JWT)
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

### Favoritos
* `POST /api/favorites/toggle` - Liga/desliga o favorito de um anúncio (requer JWT; só ATIVOS)
* `GET /api/favorites` - Meus Favoritos, recentes primeiro, indisponíveis sinalizados (requer JWT)
* `DELETE /api/favorites/:id` - Remove um favorito da lista (requer JWT, só os próprios)

---

## 🔒 Boas Práticas e Segurança Implementadas
1. **Compliance de Privacidade (LGPD)**: Rotinas automatizadas de exclusão definitiva de dados agregados ao deletar contas de usuários.
2. **Prevenção contra SQL Injection**: Query builder do Drizzle com parâmetros vinculados em todas as operações (sem concatenação de SQL).
3. **Encerramento Gracioso (Graceful Shutdown)**: Captura de sinais `SIGINT` (Ctrl+C) e `SIGTERM` para fechar conexões de banco de dados e servidores sem corromper transações.
4. **Tratamento de Exceções Globais**: Captura e registro seguro de `uncaughtException` e `unhandledRejection` para evitar instabilidade da aplicação.
