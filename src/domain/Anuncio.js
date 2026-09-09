/**
 * @file Anuncio.js
 * @description Classe que representa a Entidade Anuncio no modelo de domínio.
 * 
 * No Domain-Driven Design (DDD), a entidade `Anuncio` funciona como um ponto central de agregação de conceitos.
 * Ela orquestra relacionamentos importantes de negócios: associa um `Produto` a uma `Categoria`, pertence a um
 * `Anunciante`, possui um local de origem (`Endereco`) e é ilustrado por uma galeria de `Imagens`.
 * 
 * Além de encapsular essas relações, ela gerencia o ciclo de vida do anúncio no marketplace através do controle de estados
 * (como ATIVO, REMOVIDO ou EM_LIXEIRA) e possui regras de auto-validação para garantir que um anúncio inconsistente
 * nunca seja exposto no catálogo do sistema.
 */

class Anuncio {
  // Atributos privados encapsulados com '#'
  #id;
  #dataPublicacao;
  #status;
  #produto;
  #imagens = [];
  #anunciante;
  #categoria;
  #endereco;

  /**
   * Construtor da Entidade Anuncio.
   * Inicializa o anúncio com suas entidades associadas e metadados.
   * 
   * @param {Object} params - Parâmetros desestruturados.
   * @param {number|string} params.id - Identificador único do anúncio.
   * @param {string|Date} params.dataPublicacao - Data de criação/publicação.
   * @param {string} params.status - Estado atual do anúncio (ex: RASCUNHO, ATIVO).
   * @param {Produto} params.produto - Instância do produto anunciado.
   * @param {Array<Imagem>} params.imagens - Array de imagens ilustrativas do produto.
   * @param {Anunciante} params.anunciante - Entidade do anunciante dono deste anúncio.
   * @param {Categoria} params.categoria - Categoria do produto anunciado.
   * @param {Endereco} params.endereco - Local de localização ou entrega do produto.
   */
  constructor({ id, dataPublicacao, status, produto, imagens, anunciante, categoria, endereco }) {
    this.#id = id;
    this.#dataPublicacao = dataPublicacao;
    this.#status = status;
    this.#produto = produto;
    this.#imagens = imagens || [];
    this.#anunciante = anunciante;
    this.#categoria = categoria;
    this.#endereco = endereco;
  }

  // ==========================================
  // GETTERS (Leitura controlada dos atributos)
  // ==========================================

  get id() { return this.#id; }
  get dataPublicacao() { return this.#dataPublicacao; }
  get status() { return this.#status; }
  get produto() { return this.#produto; }
  get imagens() { return this.#imagens; }
  get anunciante() { return this.#anunciante; }
  get categoria() { return this.#categoria; }
  get endereco() { return this.#endereco; }

  // ==========================================
  // SETTERS (Alterações controladas)
  // ==========================================

  set status(value) { this.#status = value; }
  set produto(value) { this.#produto = value; }
  set imagens(value) { this.#imagens = value; }
  set anunciante(value) { this.#anunciante = value; }
  set categoria(value) { this.#categoria = value; }
  set endereco(value) { this.#endereco = value; }

  // ==========================================
  // MÉTODOS DE NEGÓCIO E MUDANÇA DE ESTADO
  // ==========================================

  /**
   * Transiciona o status do anúncio para 'ATIVO', tornando-o visível no catálogo.
   * Valida as invariantes do anúncio antes de permitir a publicação.
   */
  publicar() {
    if (!this.validar()) {
      throw new Error("Não é possível publicar um anúncio inconsistente. O anúncio exige produto, categoria, endereço e ao menos uma imagem.");
    }
    this.#status = 'ATIVO';
    this.#dataPublicacao = new Date();
  }

  /**
   * Operação de Domínio: Lógica para edição dos dados internos do anúncio.
   * Valida as alterações para manter a consistência da entidade.
   * 
   * @param {Object} novosDados - Novos dados a serem mesclados no anúncio.
   */
  editar(novosDados = {}) {
    if (novosDados.produto) this.#produto = novosDados.produto;
    if (novosDados.categoria) this.#categoria = novosDados.categoria;
    if (novosDados.endereco) this.#endereco = novosDados.endereco;
    if (novosDados.imagens) this.#imagens = novosDados.imagens;
    if (novosDados.status) this.#status = novosDados.status;
    
    if (!this.validar()) {
      throw new Error("Não é possível salvar as alterações. O anúncio precisa continuar consistente com produto, categoria, endereço e imagens.");
    }
  }

  /**
   * Coloca o anúncio temporariamente na lixeira, permitindo recuperação posterior se necessário.
   */
  moverParaLixeira() {
    this.#status = 'EM_LIXEIRA';
  }

  /**
   * Restaura um anúncio da lixeira, tornando-o novamente visível no catálogo.
   * Espelha `moverParaLixeira()` para o fluxo de restauração (RS09).
   */
  restaurar() {
    this.#status = 'ATIVO';
  }

  /**
   * Validação de Invariantes de Negócio.
   * Em DDD, uma entidade nunca deve estar em um estado inválido. Este método garante que
   * o anúncio contenha as propriedades mínimas exigidas pela regra de negócio para ser considerado consistente.
   * Exige um produto, uma categoria, um endereço de origem e pelo menos uma imagem associada.
   * 
   * @returns {boolean} True se o anúncio for consistente com as regras, falso caso contrário.
   */
  validar() {
    return !!(this.#produto && this.#categoria && this.#endereco && this.#imagens.length > 0);
  }
}

module.exports = Anuncio;
