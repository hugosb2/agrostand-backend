/**
 * @file Endereco.js
 * @description Classe que representa a Entidade Endereco no modelo de domínio.
 * 
 * No Domain-Driven Design (DDD), `Endereco` atua como uma entidade que armazena informações de localização
 * física associadas a um cliente (`clienteId`). 
 * 
 * Nota de Domínio: O atributo `zona` (ex: Urbana ou Rural) é de extrema importância no contexto do agronegócio,
 * pois define restrições de entrega e logística para fazendas e propriedades rurais que podem não possuir
 * um endereçamento postal tradicional (como ruas asfaltadas ou numeração de lotes padrão).
 */

class Endereco {
  // Atributos privados encapsulados com '#'
  #id;
  #clienteId;
  #rua;
  #numero;
  #bairro;
  #cep;
  #cidade;
  #uf;
  #zona; // Ex: 'URBANA', 'RURAL'

  /**
   * Construtor da Entidade Endereco.
   * 
   * @param {Object} params - Dados desestruturados para criação do endereço.
   * @param {number|string} params.id - O identificador único do endereço.
   * @param {number|string} params.clienteId - Identificador do Cliente proprietário do endereço.
   * @param {string} params.rua - Nome do logradouro ou rodovia.
   * @param {string} params.numero - Número do imóvel ou identificação do lote/km.
   * @param {string} params.bairro - Bairro ou região do município.
   * @param {string} params.cep - Código de Endereçamento Postal (CEP).
   * @param {string} params.cidade - Nome da cidade.
   * @param {string} params.uf - Sigla da Unidade Federativa (ex: SP, MG).
   * @param {string} params.zona - Zona geográfica (urbana ou rural).
   */
  constructor({ id, clienteId, rua, numero, bairro, cep, cidade, uf, zona }) {
    this.#id = id;
    this.#clienteId = clienteId;
    this.#rua = rua;
    this.#numero = numero;
    this.#bairro = bairro;
    this.#cep = cep;
    this.#cidade = cidade;
    this.#uf = uf;
    this.#zona = zona;
  }

  // ==========================================
  // GETTERS (Leitura controlada dos atributos)
  // ==========================================

  get id() { return this.#id; }
  get clienteId() { return this.#clienteId; }
  get rua() { return this.#rua; }
  get numero() { return this.#numero; }
  get bairro() { return this.#bairro; }
  get cep() { return this.#cep; }
  get cidade() { return this.#cidade; }
  get uf() { return this.#uf; }
  get zona() { return this.#zona; }

  // ==========================================
  // SETTERS (Alteração de campos do endereço)
  // ==========================================

  set rua(value) { this.#rua = value; }
  set numero(value) { this.#numero = value; }
  set bairro(value) { this.#bairro = value; }
  set cep(value) { this.#cep = value; }
  set cidade(value) { this.#cidade = value; }
  set uf(value) { this.#uf = value; }
  set zona(value) { this.#zona = value; }

  /**
   * Validação de Invariantes.
   * Este método verifica se as informações básicas necessárias para localizar a entrega física do produto
   * estão presentes e preenchidas. É usado antes de processar compras ou cadastros.
   * 
   * @returns {boolean} True se o endereço contiver todos os campos obrigatórios válidos.
   */
  validar() {
    return !!(this.#rua && this.#numero && this.#bairro && this.#cidade && this.#uf && this.#zona);
  }
}

module.exports = Endereco;
