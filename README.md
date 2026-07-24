# Agrostand Backend 🌾

Este diretório contém a API REST do sistema **Agrostand**, desenvolvida em Node.js com Express e SQLite.

## ⚡ Como Rodar o Projeto

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente no arquivo [.env](file:///D:/marketplace/agrostand-backend/.env) (SMTP, portas, etc.).

3. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse a API em `http://localhost:3000`.

---

## 📁 Estrutura Interna

- **[src/domain](file:///D:/marketplace/agrostand-backend/src/domain)**: Entidades de domínio (POJO/OOP com getters e setters).
- **[src/models](file:///D:/marketplace/agrostand-backend/src/models)**: Repositórios estáticos SQLite.
- **[src/controllers](file:///D:/marketplace/agrostand-backend/src/controllers)**: Lógica de controle de endpoints.
- **[src/routes](file:///D:/marketplace/agrostand-backend/src/routes)**: Definição de rotas RESTful.
- **[src/utils](file:///D:/marketplace/agrostand-backend/src/utils)**: Validadores, helpers e envio de e-mails via SMTP.

Para mais detalhes sobre as regras de negócio e diagramas UML, consulte o **[README principal do projeto na raiz](file:///D:/marketplace/README.md)**.
