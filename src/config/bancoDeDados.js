/**
 * Configuração do Banco de Dados SQLite (database.js)
 * 
 * Este arquivo é responsável por estabelecer a conexão com o banco de dados SQLite,
 * criar a estrutura de tabelas (migrações/esquema), configurar índices de performance
 * e popular dados iniciais padrão (seeds) para garantir que a aplicação funcione corretamente
 * desde a primeira execução.
 * 
 * Para um desenvolvedor júnior, pense neste arquivo como a fundação do nosso armazenamento.
 * Ele garante que a pasta do banco exista, abre o arquivo do banco, ativa regras de integridade
 * referencial (chaves estrangeiras) e cria tudo o que precisamos para rodar as queries.
 */

// Importação do driver nativo de baixo nível do SQLite3
const sqlite3 = require('sqlite3');
// Importação do método 'open' que encapsula o driver em Promises modernas (permitindo uso de async/await)
const { open } = require('sqlite');
// Módulo nativo do Node.js para manipulação de caminhos de arquivos/diretórios de forma independente de Sistema Operacional
const path = require('path');
// Módulo nativo do Node.js (File System) para manipular e verificar arquivos e diretórios no disco físico
const fs = require('fs');

// Define o caminho absoluto onde o arquivo do banco de dados SQLite (database.sqlite) será guardado.
// path.resolve garante compatibilidade de caminhos cruzando sistemas operacionais (Windows usa barra invertida, POSIX usa barra comum).
// __dirname representa a pasta onde este arquivo atual (database.js) reside. Voltamos dois níveis para a raiz do projeto.
const dbPath = path.resolve(__dirname, '../../database.sqlite');

// Variável em memória para guardar a instância única de conexão (Padrão de Projeto Singleton).
// Isso evita que fiquemos abrindo e fechando conexões repetidamente com o disco, economizando recursos de I/O.
let db = null;

/**
 * Obtém a instância única de conexão com o banco de dados.
 * Implementa o padrão Singleton: se uma conexão já estiver aberta, ela é retornada imediatamente.
 * Caso contrário, cria uma nova conexão, ativa chaves estrangeiras e retorna.
 * 
 * @returns {Promise<Database>} Instância de conexão do SQLite
 */
async function getDatabaseInstance() {
  // Se a conexão já existe, retorna-a imediatamente sem reabrir
  if (db) return db;

  // Obtém o diretório pai onde o arquivo do banco de dados deve residir
  const dbDir = path.dirname(dbPath);
  // Se o diretório não existir (ex: primeira execução do app), nós o criamos recursivamente
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Abre a conexão com o arquivo SQLite usando o driver do sqlite3
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Por padrão, o SQLite desativa a verificação de chaves estrangeiras (Foreign Keys) por compatibilidade retroativa.
  // Executamos esta PRAGMA para forçar o banco a validar chaves estrangeiras e impedir inconsistências (ex: deletar usuario sem deletar anuncios se houver restrição).
  await db.get('PRAGMA foreign_keys = ON');

  return db;
}

/**
 * Inicializa o banco de dados, criando as tabelas necessárias se elas não existirem (DDL),
 * configurando índices de busca para otimização e populando a tabela de categorias com dados iniciais (se necessário).
 */
async function initializeDatabase() {
  // Obtém a instância da conexão do banco de dados
  const database = await getDatabaseInstance();

  // Criação das Tabelas da Aplicação
  // Usamos CREATE TABLE IF NOT EXISTS para garantir que não ocorram erros de tabela duplicada ao rodar o app várias vezes.
  await database.exec(`
    -- Tabela Usuario: Guarda os dados cadastrais de clientes/anunciantes
    CREATE TABLE IF NOT EXISTS Usuario (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- Identificador único sequencial e autoincrementado
      nome TEXT NOT NULL,                  -- Nome do usuário (obrigatório)
      sobrenome TEXT NOT NULL,             -- Sobrenome (obrigatório)
      email TEXT NOT NULL UNIQUE,          -- E-mail para login, deve ser exclusivo no sistema
      telefone TEXT NOT NULL,              -- Telefone de contato
      senha_hash TEXT NOT NULL,            -- Hash criptografada da senha por segurança (usando bcrypt)
      data_cadastro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP -- Data e hora automáticas do cadastro
    );

    -- Tabela Endereco: Endereços físicos vinculados aos usuários
    CREATE TABLE IF NOT EXISTS Endereco (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,         -- Chave estrangeira que referencia a tabela Usuario
      rua TEXT NOT NULL,
      numero TEXT NOT NULL,
      bairro TEXT NOT NULL,
      cep TEXT,
      cidade TEXT NOT NULL,
      uf TEXT NOT NULL,                    -- Sigla do Estado (ex: SP, MG)
      zona TEXT NOT NULL CHECK(zona IN ('URBANA', 'RURAL')), -- Restringe os valores aceitos a URBANA ou RURAL
      -- Define o relacionamento: se o usuário dono do endereço for removido, remove o endereço automaticamente (CASCADE)
      FOREIGN KEY (cliente_id) REFERENCES Usuario(id) ON DELETE CASCADE
    );

    -- Tabela Categoria: Categorias de classificação de anúncios
    CREATE TABLE IF NOT EXISTS Categoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,           -- Nome da categoria (ex: Frutas, Legumes) - não pode repetir
      descricao TEXT                       -- Descrição breve da categoria
    );

    -- Tabela Anuncio: Anúncios de produtos agrícolas publicados por anunciantes
    CREATE TABLE IF NOT EXISTS Anuncio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anunciante_id INTEGER NOT NULL,      -- Quem está vendendo (Usuario)
      categoria_id INTEGER NOT NULL,       -- Classificação do produto (Categoria)
      endereco_id INTEGER NOT NULL,        -- Onde o produto está localizado (Endereco)
      nome TEXT NOT NULL,                  -- Título do anúncio (ex: Saca de Feijão Carioca)
      descricao TEXT NOT NULL,             -- Detalhes sobre o produto
      preco REAL NOT NULL,                 -- Preço numérico com ponto flutuante
      data_publicacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      -- Status do anúncio: restrito via CHECK constraint a ATIVO, EM_LIXEIRA ou REMOVIDO
      status TEXT NOT NULL DEFAULT 'ATIVO' CHECK(status IN ('ATIVO', 'EM_LIXEIRA', 'REMOVIDO')),
      data_remocao TEXT,                   -- Registra a data em que o anúncio foi alterado para lixeira ou removido
      -- Se o anunciante (Usuario) for excluído, exclui seus anúncios (CASCADE)
      FOREIGN KEY (anunciante_id) REFERENCES Usuario(id) ON DELETE CASCADE,
      -- Impede a exclusão de uma Categoria que tenha anúncios vinculados (RESTRICT)
      FOREIGN KEY (categoria_id) REFERENCES Categoria(id) ON DELETE RESTRICT,
      -- Impede a exclusão de um Endereco associado a anúncios ativos para evitar inconsistências (RESTRICT)
      FOREIGN KEY (endereco_id) REFERENCES Endereco(id) ON DELETE RESTRICT
    );

    -- Tabela Imagem: Fotos anexadas a um anúncio
    CREATE TABLE IF NOT EXISTS Imagem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anuncio_id INTEGER NOT NULL,         -- Anúncio ao qual a imagem pertence
      url TEXT NOT NULL,                   -- Caminho/URL da imagem salva no servidor
      tipo TEXT NOT NULL CHECK(tipo IN ('PRINCIPAL', 'SECUNDARIA')), -- Identifica se é a imagem de capa (principal) ou de galeria (secundária)
      ordem INTEGER NOT NULL,              -- Ordenação para exibição das imagens no carrossel do anúncio
      FOREIGN KEY (anuncio_id) REFERENCES Anuncio(id) ON DELETE CASCADE
    );

    -- Tabela RecuperacaoSenha: Armazena códigos temporários para redefinição de senhas expiradas
    CREATE TABLE IF NOT EXISTS RecuperacaoSenha (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,         -- Usuário que solicitou a recuperação
      codigo TEXT NOT NULL,                -- Código/Token gerado para a redefinição
      expira_em TEXT NOT NULL,             -- Timestamp do momento em que o código perde validade
      usado INTEGER NOT NULL DEFAULT 0,    -- Flag indicando se o código já foi consumido (0 = não, 1 = sim)
      FOREIGN KEY (usuario_id) REFERENCES Usuario(id) ON DELETE CASCADE
    );
  `);

  // Criação de Índices e Restrições Únicas de Alta Performance
  // Índices agilizam buscas frequentes e filtros de bancos de dados relatórios em colunas usadas frequentemente no WHERE ou JOIN.
  await database.exec(`
    -- Acelera o login e buscas de usuários pelo email
    CREATE INDEX IF NOT EXISTS idx_usuario_email ON Usuario(email);
    
    -- Acelera a filtragem e carregamento de endereços associados a um cliente específico
    CREATE INDEX IF NOT EXISTS idx_endereco_cliente ON Endereco(cliente_id);
    
    -- Acelera o carregamento de anúncios de um anunciante específico de acordo com seu status (ex: listar anúncios ativos de um produtor)
    CREATE INDEX IF NOT EXISTS idx_anuncio_anunciante_status ON Anuncio(anunciante_id, status);
    
    -- Acelera buscas no Marketplace por categoria e status (ex: filtrar apenas legumes ATIVOS)
    CREATE INDEX IF NOT EXISTS idx_anuncio_categoria_status ON Anuncio(categoria_id, status);
    
    -- Otimiza junções (JOIN) entre a tabela de anúncios e a de endereços
    CREATE INDEX IF NOT EXISTS idx_anuncio_endereco ON Anuncio(endereco_id);
    
    -- Otimiza o carregamento de imagens de um determinado anúncio
    CREATE INDEX IF NOT EXISTS idx_imagem_anuncio ON Imagem(anuncio_id);
    
    -- Otimiza consultas para verificação de chaves/tokens de recuperação de senha por usuário
    CREATE INDEX IF NOT EXISTS idx_recuperacaosenha_usuario ON RecuperacaoSenha(usuario_id);
    
    -- Índice Único Parcial: Garante no nível do banco de dados que cada anúncio
    -- possa ter NO MÁXIMO UMA imagem marcada como 'PRINCIPAL'. Imagens secundárias podem ser múltiplas.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_anuncio_imagem_principal 
    ON Imagem(anuncio_id) WHERE tipo = 'PRINCIPAL';
  `);

  // Seed (Semente) de Categorias Iniciais
  // Verifica se a tabela Categoria está completamente vazia antes de cadastrar as categorias padrão.
  // Isso impede duplicações em reinicializações futuras da aplicação.
  const categoriesCount = await database.get('SELECT COUNT(*) as count FROM Categoria');
  if (categoriesCount.count === 0) {
    const defaultCategories = [
      { nome: 'Frutas', descricao: 'Frutas frescas colhidas diretamente do produtor' },
      { nome: 'Legumes', descricao: 'Legumes e hortaliças frescas e variadas' },
      { nome: 'Verduras', descricao: 'Folhas verdes e ervas frescas' },
      { nome: 'Grãos', descricao: 'Grãos, cereais, feijão, arroz e sementes' },
      { nome: 'Outros', descricao: 'Outros produtos agrícolas e derivados artesanais' }
    ];

    // Percorre a lista de categorias padrão e insere cada uma de forma segura no banco de dados.
    // Usamos placeholders (?) para evitar ataques de injeção de SQL (SQL Injection).
    for (const cat of defaultCategories) {
      await database.run(
        'INSERT INTO Categoria (nome, descricao) VALUES (?, ?)',
        [cat.nome, cat.descricao]
      );
    }
  }

  console.log('Database initialized successfully.');
}

// Exportamos as funções getDatabaseInstance (para uso nos modelos/repositórios)
// e initializeDatabase (chamada na inicialização do servidor), bem como o caminho dbPath.
module.exports = {
  getDatabaseInstance,
  initializeDatabase,
  dbPath
};
