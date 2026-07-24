/**
 * Configuração do Multer para Upload de Arquivos (multer.js)
 * 
 * Este arquivo é responsável por configurar o middleware Multer, que lida com requisições do tipo 
 * 'multipart/form-data' (essencialmente upload de arquivos de imagem no backend).
 * Ele define onde as imagens serão salvas, como os nomes dos arquivos serão gerados para evitar 
 * colisões, quais tipos de arquivos são permitidos (filtro por Mime Type) e o limite de tamanho.
 * 
 * Para um desenvolvedor júnior, imagine o Multer como uma recepcionista na portaria da API. 
 * Quando alguém envia uma imagem de produto, o Multer valida se é de fato uma imagem permitida, 
 * se o tamanho não ultrapassa o limite e escolhe um "armário" (pasta) com uma "etiqueta" (nome único) 
 * para guardar esse arquivo antes que ele chegue ao nosso banco de dados.
 */

// Importação do pacote Multer, um middleware Node.js para manipulação de uploads
const multer = require('multer');
// Módulo nativo para trabalhar com caminhos de arquivos e extensões de forma consistente
const path = require('path');
// Módulo nativo File System para gerenciar e criar diretórios no servidor
const fs = require('fs');

// Define o diretório de destino onde os arquivos enviados serão fisicamente salvos.
// Neste caso, na pasta pública 'public/uploads' para que possam ser servidos estaticamente pelo servidor Web.
const uploadDir = path.resolve(__dirname, '../../public/uploads');

// Garante que o diretório de upload exista no disco rígido do servidor.
// Se não existir (ex: primeira inicialização), o fs.mkdirSync o criará recursivamente.
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do motor de armazenamento no disco (diskStorage).
// Controla o destino do arquivo e como ele será nomeado ao ser gravado.
const storage = multer.diskStorage({
  // Define a pasta de destino do upload
  destination: (req, file, cb) => {
    // O primeiro parâmetro do callback (cb) é o erro (null se tudo estiver certo),
    // e o segundo é o caminho da pasta destino.
    cb(null, uploadDir);
  },
  // Define o nome que o arquivo terá no servidor para evitar conflito de nomes duplicados
  filename: (req, file, cb) => {
    // Cria um sufixo único baseado no timestamp atual (data em milissegundos) 
    // somado a um número randômico de 0 a 1 bilhão.
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Extrai a extensão original do arquivo enviado (ex: .png, .jpg)
    const ext = path.extname(file.originalname);
    // Retorna o nome final composto pelo nome do campo no formulário + sufixo único + extensão original.
    // Exemplo final: imagem-1689234857213-98471203.jpg
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

/**
 * Filtro de arquivos (fileFilter).
 * Analisa as propriedades do arquivo enviado e decide se ele deve ser aceito ou rejeitado.
 * Aqui, restringimos apenas a formatos comuns de imagens.
 */
const fileFilter = (req, file, cb) => {
  // Array com os Mime Types permitidos no sistema
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  
  // Verifica se o tipo de mídia (mimetype) do arquivo enviado está na lista permitida
  if (allowedMimeTypes.includes(file.mimetype)) {
    // Aceita o arquivo (erro null, boolean true)
    cb(null, true);
  } else {
    // Rejeita o arquivo retornando um erro explicativo (erro instanciado, boolean false)
    cb(new Error('Formato de imagem inválido. Apenas JPG, JPEG, PNG e WEBP são permitidos.'), false);
  }
};

/**
 * Instanciação e configuração final do middleware Multer.
 */
const upload = multer({
  // Configuração de armazenamento física definida acima
  storage: storage,
  // Limites de upload (Regras de Negócio / Requisitos Não Funcionais)
  limits: {
    // Limite máximo de tamanho do arquivo em bytes (10MB no total, atendendo ao RNF03)
    fileSize: 10 * 1024 * 1024 // 10 megabytes = 10 * 1024 KB * 1024 Bytes
  },
  // Função de validação de tipo de arquivo
  fileFilter: fileFilter
});

// Exporta o middleware configurado para ser importado e injetado nas rotas que necessitam de upload
module.exports = upload;
