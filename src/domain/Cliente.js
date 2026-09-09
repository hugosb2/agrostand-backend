/**
 * @file Cliente.js
 * @description Classe que representa a Entidade Cliente no modelo de domínio.
 * 
 * No Domain-Driven Design (DDD), a especialização por herança é utilizada quando uma entidade
 * possui um papel ou comportamento estendido em relação à outra. Aqui, `Cliente` estende a classe
 * `Usuario`, o que significa que ele possui todos os dados de login e cadastro gerais de um usuário,
 * mas também comporta relações de negócios específicas, como a lista de endereços de entrega e 
 * as interações de navegação/compra no marketplace.
 */

const Usuario = require('./Usuario');

class Cliente extends Usuario {
  // Atributo privado que mantém a lista de endereços associados a este cliente.
  // Demonstra um relacionamento de 1 para N (Um cliente possui vários endereços).
  #enderecos = [];

  /**
   * Construtor da Entidade Cliente.
   * Invoca o construtor da classe base (Usuario) usando super(data) e inicializa
   * a lista de endereços do cliente se ela for fornecida nos dados iniciais.
   * 
   * @param {Object} data - Dados para criação do cliente (contendo os campos de Usuario e enderecos).
   */
  constructor(data) {
    super(data);
    if (data.enderecos) {
      this.#enderecos = data.enderecos;
    }
  }

  // ==========================================
  // GETTERS & SETTERS
  // ==========================================

  get enderecos() { return this.#enderecos; }
  set enderecos(value) { this.#enderecos = value; }
}

module.exports = Cliente;
