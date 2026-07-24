/**
 * @file Usuario.js
 * @description Classe que representa a Entidade Usuario no modelo de domínio.
 * 
 * No Domain-Driven Design (DDD), uma Entidade é um objeto que possui uma identidade única (representada aqui pelo ID)
 * que persiste através de mudanças em seus atributos. Ao contrário de Objetos de Valor (Value Objects), onde a igualdade
 * é definida pela igualdade dos atributos, a igualdade de uma Entidade é definida por sua identidade única.
 * 
 * Esta classe encapsula informações de cadastro e autenticação de usuários, definindo comportamentos e regras de negócio
 * associados à identidade de um usuário do sistema.
 */

const bcrypt = require('bcryptjs');

class Usuario {
  // Uso de campos privados (#) do JavaScript moderno para garantir o encapsulamento rígido.
  // Isso impede o acesso ou modificação externa direta, forçando o uso de métodos (getters/setters)
  // que podem conter lógica de validação no futuro.
  #id;
  #nome;
  #sobrenome;
  #email;
  #telefone;
  #senhaHash;
  #dataCadastro;

  /**
   * Construtor da Entidade Usuario.
   * Inicializa o objeto com os dados passados em um objeto de desestruturação.
   * 
   * @param {Object} params - Parâmetros para criação do usuário.
   * @param {number|string} params.id - O identificador único da entidade.
   * @param {string} params.nome - O primeiro nome do usuário.
   * @param {string} params.sobrenome - O sobrenome do usuário.
   * @param {string} params.email - O e-mail (usado como login e chave de contato).
   * @param {string} params.telefone - Número de contato telefônico do usuário.
   * @param {string} params.senhaHash - Senha já criptografada (hash) para segurança.
   * @param {string|Date} params.dataCadastro - A data e hora em que o usuário se cadastrou.
   */
  constructor({ id, nome, sobrenome, email, telefone, senhaHash, dataCadastro }) {
    this.#id = id;
    this.#nome = nome;
    this.#sobrenome = sobrenome;
    this.#email = email;
    this.#telefone = telefone;
    this.#senhaHash = senhaHash;
    this.#dataCadastro = dataCadastro;
  }

  // ==========================================
  // GETTERS (Acesso controlado aos dados)
  // Permitem a leitura dos campos privados de fora da classe.
  // ==========================================

  get id() { return this.#id; }
  get nome() { return this.#nome; }
  get sobrenome() { return this.#sobrenome; }
  get email() { return this.#email; }
  get telefone() { return this.#telefone; }
  get senhaHash() { return this.#senhaHash; }
  get dataCadastro() { return this.#dataCadastro; }

  // ==========================================
  // SETTERS (Alteração controlada dos dados)
  // Permitem a atualização dos campos privados.
  // No DDD, devemos evitar expor setters cegamente para todos os atributos,
  // pois alterações devem ocorrer através de métodos de negócio explícitos.
  // No entanto, estes setters fornecem flexibilidade inicial mantendo a sintaxe controlada.
  // ==========================================

  set nome(value) { this.#nome = value; }
  set sobrenome(value) { this.#sobrenome = value; }
  set email(value) { this.#email = value; }
  set telefone(value) { this.#telefone = value; }
  set senhaHash(value) { this.#senhaHash = value; }
  set dataCadastro(value) { this.#dataCadastro = value; }

  /**
   * Método de negócio para verificar/autenticar a identidade do usuário.
   * Compara o e-mail fornecido com o e-mail cadastrado na entidade.
   * 
   * Nota educacional: Em uma implementação completa, a validação de senha também ocorreria
   * aqui comparando a senha em texto puro com o `#senhaHash` salvo (usando bibliotecas como bcrypt).
   * 
   * @param {string} email - E-mail para tentativa de login.
   * @param {string} senha - Senha pura para verificação.
   * @returns {boolean} True se o e-mail coincidir, falso caso contrário.
   */
  autenticar(email, senha) {
    // Verifica se o e-mail coincide e depois usa o bcrypt de forma síncrona para comparar a senha pura com o hash
    return this.#email === email && bcrypt.compareSync(senha, this.#senhaHash); 
  }

  /**
   * Operação de Domínio (Domain Operation).
   * Em DDD, as entidades contêm comportamento de negócios. Este método representa o processo
   * de alteração/atualização dos dados do próprio usuário, garantindo consistência interna.
   * @param {Object} novosDados - Novos dados a serem aplicados ao usuário.
   */
  atualizarDados(novosDados = {}) {
    if (novosDados.nome) this.#nome = novosDados.nome;
    if (novosDados.sobrenome) this.#sobrenome = novosDados.sobrenome;
    if (novosDados.telefone) this.#telefone = novosDados.telefone;
    if (novosDados.email) this.#email = novosDados.email;
    if (novosDados.senhaHash) this.#senhaHash = novosDados.senhaHash;
  }

  /**
   * Método de conversão para objeto simples.
   * É uma boa prática para que a entidade possa ser convertida em um formato padrão (JSON)
   * sem expor dados confidenciais (por exemplo, omitindo a propriedade privada `#senhaHash`).
   * 
   * @returns {Object} Representação pública e serializável do usuário.
   */
  toJSON() {
    return {
      id: this.#id,
      nome: this.#nome,
      sobrenome: this.#sobrenome,
      email: this.#email,
      telefone: this.#telefone,
      dataCadastro: this.#dataCadastro
    };
  }
}

module.exports = Usuario;
