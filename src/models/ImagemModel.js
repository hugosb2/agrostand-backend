/**
 * @file ImagemModel.js
 * @description Modelo de dados para a entidade Imagem (Image).
 * Encapsula as operações de banco de dados para a tabela `Imagem`. As imagens estão associadas
 * aos anúncios (`Anuncio`) da plataforma, permitindo categorizá-las em 'PRINCIPAL' (destaque do anúncio)
 * e 'SECUNDARIA', além de controlar a ordem de exibição na galeria de fotos do produto.
 * 
 * Interações com o Banco de Dados:
 * - Realiza inserções, consultas, atualizações e deleções físicas na tabela `Imagem`.
 * - Relaciona-se com a tabela `Anuncio` por meio do campo chave estrangeira `anuncio_id`.
 */

const { getDatabaseInstance } = require('../config/bancoDeDados');

class ImagemModel {
  /**
   * Associa uma nova imagem a um anúncio específico.
   * 
   * @param {Object} params - Dados da imagem.
   * @param {number} params.anuncioId - ID do anúncio ao qual a imagem pertence.
   * @param {string} params.url - URL ou caminho do arquivo da imagem hospedado.
   * @param {string} params.tipo - Tipo de imagem (ex: 'PRINCIPAL' ou 'SECUNDARIA').
   * @param {number} params.ordem - Valor numérico que define a ordem de visualização na galeria.
   * @returns {Promise<number>} Retorna o ID gerado pelo banco de dados para o imagem inserida (`lastID`).
   * 
   * Operação DB:
   * - Executa o comando INSERT INTO Imagem (anuncio_id, url, tipo, ordem) VALUES (?, ?, ?, ?).
   * - Usa `db.run()` para a gravação e retorna a propriedade `lastID` gerada no SQLite.
   */
  static async create({ anuncioId, url, tipo, ordem }) {
    const db = await getDatabaseInstance();
    const result = await db.run(
      `INSERT INTO Imagem (anuncio_id, url, tipo, ordem)
       VALUES (?, ?, ?, ?)`,
      [anuncioId, url, tipo, ordem]
    );
    return result.lastID;
  }

  /**
   * Busca uma imagem específica pelo seu ID.
   * 
   * @param {number} id - O ID da imagem.
   * @returns {Promise<Object|undefined>} Retorna a imagem correspondente ao ID ou `undefined`.
   * 
   * Operação DB:
   * - Executa a consulta SELECT * FROM Imagem WHERE id = ?.
   * - Usa `db.get()` para trazer apenas um registro.
   */
  static async findById(id) {
    const db = await getDatabaseInstance();
    return await db.get('SELECT * FROM Imagem WHERE id = ?', [id]);
  }

  /**
   * Busca todas as imagens associadas a um anúncio específico.
   * As imagens são ordenadas de forma que as imagens 'PRINCIPAL' apareçam primeiro (ordem decrescente
   * por tipo, assumindo que alfabeticamente 'PRINCIPAL' > 'SECUNDARIA' pode ser o caso, ou pelo design
   * específico do banco), seguido pelo campo de prioridade `ordem` de forma ascendente.
   * 
   * @param {number} anuncioId - ID do anúncio cujas imagens serão retornadas.
   * @returns {Promise<Array<Object>>} Retorna uma lista de objetos representando as imagens do anúncio.
   * 
   * Operação DB:
   * - Executa SELECT * FROM Imagem WHERE anuncio_id = ? ORDER BY tipo DESC, ordem ASC.
   * - Usa `db.all()` para retornar a coleção inteira em um array.
   */
  static async findByAdId(anuncioId) {
    const db = await getDatabaseInstance();
    return await db.all(
      'SELECT * FROM Imagem WHERE anuncio_id = ? ORDER BY tipo DESC, ordem ASC',
      [anuncioId]
    );
  }

  /**
   * Remove uma imagem específica pelo seu ID do banco de dados.
   * 
   * @param {number} id - ID da imagem a ser excluída.
   * @returns {Promise<boolean>} Retorna `true` se a exclusão foi executada com sucesso.
   * 
   * Operação DB:
   * - Executa o comando DELETE FROM Imagem WHERE id = ?.
   * - Usa `db.run()` para realizar a deleção física.
   */
  static async delete(id) {
    const db = await getDatabaseInstance();
    await db.run('DELETE FROM Imagem WHERE id = ?', [id]);
    return true;
  }

  /**
   * Remove todas as imagens de um determinado anúncio.
   * Geralmente utilizada quando um anúncio é excluído definitivamente do sistema, para evitar dados órfãos.
   * 
   * @param {number} anuncioId - ID do anúncio.
   * @returns {Promise<boolean>} Retorna `true` após a deleção.
   * 
   * Operação DB:
   * - Executa o comando DELETE FROM Imagem WHERE anuncio_id = ?.
   * - Usa `db.run()` para limpar todos os registros de imagem vinculados ao anúncio.
   */
  static async deleteByAdId(anuncioId) {
    const db = await getDatabaseInstance();
    await db.run('DELETE FROM Imagem WHERE anuncio_id = ?', [anuncioId]);
    return true;
  }

  /**
   * Atualiza o valor de prioridade (`ordem`) de uma imagem.
   * Utilizado para reordenar a galeria de imagens de um anúncio.
   * 
   * @param {number} id - ID da imagem.
   * @param {number} ordem - O novo valor sequencial da ordem da imagem.
   * @returns {Promise<boolean>} Retorna `true` após o sucesso do UPDATE.
   * 
   * Operação DB:
   * - Executa UPDATE Imagem SET ordem = ? WHERE id = ?.
   * - Usa `db.run()` para aplicar a mudança.
   */
  static async updateOrdem(id, ordem) {
    const db = await getDatabaseInstance();
    await db.run('UPDATE Imagem SET ordem = ? WHERE id = ?', [ordem, id]);
    return true;
  }
}

module.exports = ImagemModel;
