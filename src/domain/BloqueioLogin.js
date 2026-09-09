/**
 * @file BloqueioLogin.js
 * @description Entidade de domínio da regra RN19: após N falhas consecutivas
 * de login, o e-mail é bloqueado temporariamente. Só um login bem-sucedido
 * zera a contagem. Tempos injetados (`agora`) para testabilidade.
 */

class BloqueioLogin {
  #email;
  #tentativas;
  #bloqueadoAte; // ISO string | null

  constructor({ email, tentativas = 0, bloqueadoAte = null }) {
    this.#email = email;
    this.#tentativas = tentativas;
    this.#bloqueadoAte = bloqueadoAte;
  }

  get email() { return this.#email; }
  get tentativas() { return this.#tentativas; }
  get bloqueadoAte() { return this.#bloqueadoAte; }

  /** @param {Date} [agora] */
  bloqueado(agora = new Date()) {
    return !!(this.#bloqueadoAte && new Date(this.#bloqueadoAte) > agora);
  }

  /**
   * Registra uma falha; a partir do limite, agenda o desbloqueio.
   * @returns {boolean} se ficou bloqueado.
   */
  registrarFalha({ limite = 3, minutos = 15, agora = new Date() } = {}) {
    this.#tentativas += 1;
    if (this.#tentativas >= limite) {
      this.#bloqueadoAte = new Date(agora.getTime() + minutos * 60000).toISOString();
    }
    return this.bloqueado(agora);
  }

  resetar() {
    this.#tentativas = 0;
    this.#bloqueadoAte = null;
  }
}

module.exports = BloqueioLogin;
