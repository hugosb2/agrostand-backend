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

  // ==========================================
  // MÉTODOS DE COMPORTAMENTO DO DOMÍNIO
  // Em DDD, as entidades contêm lógica rica e métodos que representam as ações do mundo real.
  // ==========================================

  /**
   * Operação de Domínio: Permite ao cliente pesquisar anúncios por um termo específico em uma lista fornecida.
   * 
   * @param {Array<Anuncio>} anuncios - Lista completa de anúncios a filtrar.
   * @param {string} termo - O texto a ser pesquisado.
   * @returns {Array<Anuncio>} Anúncios filtrados.
   */
  pesquisarAnuncios(anuncios, termo) {
    if (!anuncios || !Array.isArray(anuncios)) return [];
    if (!termo) return anuncios;
    const termoLower = termo.toLowerCase();
    return anuncios.filter(a => {
      const nomeProd = a.produto && typeof a.produto.nome === 'string' ? a.produto.nome.toLowerCase() : '';
      const descProd = a.produto && typeof a.produto.descricao === 'string' ? a.produto.descricao.toLowerCase() : '';
      return nomeProd.includes(termoLower) || descProd.includes(termoLower);
    });
  }

  /**
   * Operação de Domínio: Permite navegar pelas páginas da lista de anúncios fornecida.
   * 
   * @param {Array<Anuncio>} anuncios - Lista completa de anúncios.
   * @param {number} pagina - O número da página desejada.
   * @param {number} [limite=10] - Quantidade máxima de registros por página.
   * @returns {Array<Anuncio>} Lista paginada de anúncios.
   */
  navegarPorAnuncios(anuncios, pagina, limite = 10) {
    if (!anuncios || !Array.isArray(anuncios)) return [];
    const p = Math.max(1, pagina || 1);
    const offset = (p - 1) * limite;
    return anuncios.slice(offset, offset + limite);
  }

  /**
   * Operação de Domínio: Permite ao cliente visualizar os detalhes de um anúncio.
   * 
   * @param {Anuncio} anuncio - Instância do anúncio a ser visualizado.
   * @returns {Anuncio} O próprio anúncio visualizado.
   */
  visualizarAnuncio(anuncio) {
    // Retorna o próprio anúncio. Pode ser estendido no futuro para auditoria de visualizações.
    return anuncio;
  }

  /**
   * Operação de Domínio: Inicia o contato do cliente com o anunciante/vendedor.
   * Gera um link de clique para conversar (Click to Chat) no WhatsApp do anunciante (RS01).
   * 
   * @param {Anuncio} anuncio - Instância do anúncio com o qual o cliente deseja interagir.
   * @returns {string} Link de contato do WhatsApp.
   */
  contatarVendedor(anuncio) {
    if (!anuncio || !anuncio.anunciante) {
      throw new Error("Anúncio ou anunciante inválido para contato.");
    }
    const telefone = anuncio.anunciante.telefone;
    const nomeVendedor = anuncio.anunciante.nome || 'Vendedor';
    const nomeProduto = anuncio.produto ? anuncio.produto.nome : 'produto';
    const texto = `Olá ${nomeVendedor}, estou interessado no seu anúncio do produto "${nomeProduto}" cadastrado no Agrostand.`;
    
    // Limpa caracteres não numéricos do telefone
    const apenasNumeros = String(telefone).replace(/\D/g, '');
    // Se não tiver o código DDI do país, assume Brasil (55)
    const ddi = apenasNumeros.startsWith('55') ? '' : '55';
    
    return `https://wa.me/${ddi}${apenasNumeros}?text=${encodeURIComponent(texto)}`;
  }

  /**
   * Método de negócio para adicionar um novo endereço à lista do cliente.
   * Centraliza a lógica de associação, evitando manipulação direta do array fora da classe.
   * 
   * @param {Endereco} endereco - Instância do endereço do cliente a ser cadastrado.
   */
  cadastrarEndereco(endereco) {
    this.#enderecos.push(endereco);
  }

  /**
   * Método de conversão para JSON.
   * Utiliza a desestruturação do super.toJSON() para trazer os atributos herdados do Usuario,
   * combinando-os com os dados de endereço do próprio Cliente de forma serializada.
   * 
   * @returns {Object} Representação em formato de objeto simples/JSON.
   */
  toJSON() {
    return {
      ...super.toJSON(),
      // Serializa recursivamente cada endereço cadastrado se possuir a função toJSON
      enderecos: this.#enderecos.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e))
    };
  }
}

module.exports = Cliente;
