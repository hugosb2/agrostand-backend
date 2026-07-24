/**
 * @file armazenamentoService.js
 * @description Serviço de armazenamento (Storage Service) do sistema Agrostand.
 * Este serviço é responsável por gerenciar o ciclo de vida dos arquivos de mídia (imagens)
 * enviados pelos usuários (como fotos de produtos ou imagens de perfil). Ele lida com a
 * validação de tamanho e tipo do arquivo de imagem, simula o upload para um serviço de nuvem
 * (gerando URLs públicas de acesso) e realiza a remoção física de arquivos locais no cleanup.
 * 
 * Papel no fluxo de negócios:
 * - Quando um produto é cadastrado ou atualizado com uma imagem, o controlador delega a este serviço
 *   a tarefa de validar a imagem e retornar a URL que será persistida no banco de dados SQLite.
 * - Caso um produto seja excluído, este serviço é acionado para remover o arquivo correspondente,
 *   evitando o desperdício de espaço no servidor de hospedagem.
 */

const fs = require('fs');
const path = require('path');

// Diretório local de uploads. Resolve o caminho absoluto apontando para 'public/uploads'
// que é o local onde o middleware (como o multer) salva temporariamente os arquivos físicos.
const uploadDir = path.resolve(__dirname, '../../public/uploads');

class ArmazenamentoService {
  /**
   * Realiza o "upload" de uma imagem recebida na requisição.
   * 
   * Requisito de Sistema (RS02): Serviço de Armazenamento.
   * Este método simula o upload para um provedor de nuvem (como AWS S3 ou Google Cloud Storage).
   * Em produção, este método chamaria o SDK do S3/GCS correspondente, faria o upload via stream/buffer
   * e retornaria a URL do bucket.
   * Para desenvolvimento local, mantemos o arquivo no servidor e retornamos o link público local.
   * 
   * @param {Object} file - Objeto de arquivo fornecido pelo multer (contendo mimetype, size, filename, etc.)
   * @param {Object} req - Objeto de requisição do Express (necessário para descobrir dinamicamente o protocolo/host do servidor)
   * @returns {Promise<string|null>} URL pública de acesso à imagem ou null se não houver arquivo
   */
  static async uploadImage(file, req) {
    // Se nenhum arquivo foi enviado no formulário, retorna null silenciosamente
    if (!file) return null;

    // Validação de tamanho da imagem (Requisito Não Funcional RNF03: tamanho limite de até 10MB)
    const maxSize = 10 * 1024 * 1024; // 10 Megabytes em bytes
    if (file.size > maxSize) {
      throw new Error('A imagem excede o tamanho limite de 10 MB.');
    }

    // Validação do tipo mime da imagem (Formatos aceitos pelo sistema)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Formato de imagem inválido. Apenas JPG, JPEG, PNG e WEBP são permitidos.');
    }

    // Em uma implementação real com AWS S3 / Google Cloud:
    // const s3Client = new S3Client(...);
    // await s3Client.send(new PutObjectCommand(...));
    // return `https://meu-bucket-s3.s3.amazonaws.com/${file.filename}`;

    // Configurações para gerar o link público dinamicamente para o ambiente de desenvolvimento local:
    const port = process.env.PORT || 3000;
    // Identifica se a requisição é segura (HTTPS) para definir o protocolo correto
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    // Obtém o host atual (ex: localhost:3000 ou api.agrostand.com)
    const host = req.headers.host || `localhost:${port}`;
    
    // Retorna a URL final da imagem apontando para a pasta estática do servidor Express
    return `${protocol}://${host}/uploads/${file.filename}`;
  }

  /**
   * Exclui uma imagem do armazenamento físico local ou em nuvem a partir de sua URL.
   * 
   * @param {string} url - URL pública da imagem salva no banco de dados.
   * @returns {Promise<void>}
   */
  static async deleteImage(url) {
    if (!url) return;

    try {
      // Extrai o nome do arquivo a partir da URL.
      // Exemplo: 'http://localhost:3000/uploads/imagem-12345.png' -> ['', 'imagem-12345.png']
      const parts = url.split('/uploads/');
      if (parts.length > 1) {
        const filename = parts[1];
        // Reconstrói o caminho físico absoluto onde o arquivo está guardado no disco do servidor
        const filePath = path.join(uploadDir, filename);
        
        // Verifica se o arquivo realmente existe no disco antes de tentar excluí-lo
        if (fs.existsSync(filePath)) {
          // Remove o arquivo de forma síncrona
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      // Evitamos lançar exceções em erros de limpeza de imagem para não interromper outros fluxos
      // de negócios importantes (como a deleção do produto em si). Apenas registramos o erro no console.
      console.error(`Error deleting image: ${err.message}`);
    }
  }
}

module.exports = ArmazenamentoService;
