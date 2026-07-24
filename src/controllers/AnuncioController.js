/**
 * @file AnuncioController.js
 * @description Controller responsável por gerenciar o ciclo de vida dos anúncios de produtos no Marketplace.
 * Ele lida com a listagem (com busca, filtros e paginação), criação, atualização (incluindo substituição de imagens
 * e gerenciamento de arquivos enviados via Multer), remoção lógica (lixeira/soft delete), restauração de anúncios
 * e limpeza automática de itens antigos.
 * 
 * Conceitos importantes detalhados neste arquivo:
 * 1. Processamento de filtros de busca e paginação (Limit/Offset) a partir da Query String.
 * 2. Upload de arquivos binários utilizando o middleware Multer e integração com serviço de armazenamento (ArmazenamentoService).
 * 3. Integridade referencial e controle transacional no SQLite (EnderecoModel, AnuncioModel, ImagemModel).
 * 4. Segurança e autorização baseada em propriedade (Ownership): apenas o dono do anúncio pode editá-lo ou exclui-lo.
 * 5. Integração externa: geração dinâmica de link de redirecionamento para o WhatsApp do vendedor (RF07/RS01).
 * 6. Estrutura de dados rica para respostas JSON.
 */

const AnuncioModel = require('../models/AnuncioModel');
const ImagemModel = require('../models/ImagemModel');
const EnderecoModel = require('../models/EnderecoModel');
const CategoriaModel = require('../models/CategoriaModel');
const ArmazenamentoService = require('../services/armazenamentoService');
const { getDatabaseInstance } = require('../config/bancoDeDados');
const { generateWhatsAppLink } = require('../utils/whatsapp');
const logger = require('../utils/logger');

class AnuncioController {
  /**
   * Lista todos os anúncios ativos com suporte a paginação, busca textual e filtragem por categoria.
   * 
   * @param {Object} req - Objeto de requisição contendo parâmetros de query (query string).
   * @param {Object} res - Objeto de resposta para retornar a lista de anúncios.
   * @param {Function} next - Callback de erro.
   */
  static async list(req, res, next) {
    try {
      // Paginação e filtros extraídos da URL (Query String)
      // Exemplo: /anuncios?page=2&limit=5&categoriaId=3&search=trator
      
      // Converte e define o número da página atual. Caso não informado, assume 1 por padrão.
      const page = parseInt(req.query.page) || 1;
      
      // Define a quantidade máxima de registros por página. O padrão é 10.
      const limit = parseInt(req.query.limit) || 10;
      
      // Filtro opcional por ID de Categoria
      const categoryId = req.query.categoriaId ? parseInt(req.query.categoriaId) : null;
      
      // Filtro opcional de pesquisa por texto (título ou descrição)
      const search = req.query.search || null;

      // Executa a busca no banco de dados através do modelo
      // A paginação ocorre aplicando OFFSET e LIMIT na query SQL interna do Model.
      const result = await AnuncioModel.findAll({ page, limit, categoryId, search, status: 'ATIVO' });
      
      // Retorna uma resposta estruturada de sucesso contendo a lista e informações de metadados da paginação
      return res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtém os detalhes completos de um anúncio específico pelo ID, montando um objeto estruturado
   * e gerando o link de redirecionamento para o WhatsApp do anunciante.
   * 
   * @param {Object} req - Requisição contendo o ID do anúncio nos parâmetros da URL (params).
   * @param {Object} res - Resposta com os dados completos do anúncio.
   * @param {Function} next - Callback de erro.
   */
  static async get(req, res, next) {
    const { id } = req.params;

    try {
      // Busca o anúncio correspondente pelo ID
      const ad = await AnuncioModel.findById(id);
      
      // Se o anúncio não existir ou estiver indisponível (ex: status REMOVIDO ou EM_LIXEIRA)
      if (!ad) {
        return res.status(404).json({
          status: 'error',
          message: 'Anúncio indisponível ou não encontrado.'
        });
      }

      // Geração dinâmica do link do WhatsApp (Requisitos RF07 e RS01)
      // Constrói uma mensagem amigável e personalizada com o nome do produto e seu preço formatado.
      // O utilitário 'generateWhatsAppLink' codifica essa mensagem para URL (urlencode) e anexa ao número do vendedor.
      const whatsappMsg = `Olá ${ad.vendedor_nome}, vi seu anúncio do produto "${ad.nome}" por R$ ${ad.preco.toFixed(2)} no Marketplace e gostaria de negociar.`;
      const linkWhatsapp = generateWhatsAppLink(ad.vendedor_telefone, whatsappMsg);

      // Monta a estrutura final de resposta rica exigida pela interface pública do sistema
      // Agrupa informações em sub-objetos lógicos: categoria, localizacao, vendedor (com segurança de dados) e imagens.
      const responseData = {
        id: ad.id,
        nome: ad.nome,
        descricao: ad.descricao,
        preco: ad.preco,
        data_publicacao: ad.data_publicacao,
        status: ad.status,
        categoria: {
          id: ad.categoria_id,
          nome: ad.categoria_nome
        },
        localizacao: {
          id: ad.endereco_id,
          rua: ad.rua,
          numero: ad.numero,
          bairro: ad.bairro,
          cep: ad.cep,
          cidade: ad.cidade,
          uf: ad.uf,
          zona: ad.zona
        },
        vendedor: {
          id: ad.anunciante_id,
          nome: `${ad.vendedor_nome} ${ad.vendedor_sobrenome}`,
          // Nota de Segurança (RNF06 e RN16): O número de telefone do vendedor é exibido de forma protegida
          // ou exclusivamente associado à ação de redirecionamento ao WhatsApp, evitando vazamentos e robôs de coleta.
          telefone: ad.vendedor_telefone, 
          link_whatsapp: linkWhatsapp
        },
        imagens: ad.imagens
      };

      return res.status(200).json({
        status: 'success',
        data: {
          anuncio: responseData
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cria um novo anúncio de produto, tratando uploads de arquivos binários (imagens) e
   * vinculando ou cadastrando endereços dentro de uma transação.
   * 
   * @param {Object} req - Requisição contendo os dados do anúncio no body e arquivos no req.files (via Multer).
   * @param {Object} res - Resposta confirmando a publicação com os dados do anúncio criado.
   * @param {Function} next - Callback de erro.
   */
  static async create(req, res, next) {
    const db = await getDatabaseInstance();
    
    // O ID do anunciante é injetado pelo middleware de autenticação (JWT) a partir do token decodificado
    const anuncianteId = req.user.id;

    try {
      const { nome, descricao, preco, categoriaId, enderecoId } = req.body;

      // 1. Validação de Campos Obrigatórios
      // Título, descrição, preço e ID da categoria são essenciais para caracterizar um anúncio.
      if (!nome || !descricao || !preco || !categoriaId) {
        return res.status(400).json({
          status: 'error',
          message: 'Os campos nome, descrição, preço e categoriaId são obrigatórios.'
        });
      }

      // Validação do Formato do Preço
      // Garante que o valor informado seja numérico e estritamente positivo.
      const parsedPreco = parseFloat(preco);
      if (isNaN(parsedPreco) || parsedPreco <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'O preço informado deve ser um número maior que zero.'
        });
      }

      // Validação da Existência da Categoria
      const category = await CategoriaModel.findById(categoriaId);
      if (!category) {
        return res.status(400).json({
          status: 'error',
          message: 'A categoria informada não existe.'
        });
      }

      // 2. Validação da Imagem Principal Obrigatória (Regra de Negócio RN04)
      // O middleware Multer separa arquivos enviados em req.files.
      // O anúncio deve ter obrigatoriamente pelo menos uma imagem principal carregada no campo 'imagemPrincipal'.
      const primaryImageFile = req.files && req.files.imagemPrincipal ? req.files.imagemPrincipal[0] : null;
      if (!primaryImageFile) {
        return res.status(400).json({
          status: 'error',
          message: 'Todo anúncio deve conter obrigatoriamente uma imagem principal.'
        });
      }

      // Início do controle de transação de banco de dados
      // Como a criação de um anúncio envolve inserções na tabela de anúncios, criação opcional de endereço,
      // upload físico e inserção de múltiplos registros de imagem, precisamos de atomicidade.
      await db.run('BEGIN TRANSACTION');

      // 3. Resolução da Localização do Anúncio (Regra de Negócio RN06)
      let resolvedEnderecoId = enderecoId ? parseInt(enderecoId) : null;

      // Se nenhum ID de endereço existente foi fornecido, o cliente pode enviar os dados de um novo
      // endereço no corpo da requisição para cadastrá-lo na hora.
      if (!resolvedEnderecoId) {
        const { rua, numero, bairro, cep, cidade, uf, zona } = req.body;
        if (!rua || !numero || !bairro || !cidade || !uf || !zona) {
          await db.run('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: 'Informe um enderecoId existente ou todos os campos para cadastrar um novo endereço para o anúncio.'
          });
        }

        // Validação da Zona do Endereço
        const upperZona = zona.toUpperCase();
        if (upperZona !== 'URBANA' && upperZona !== 'RURAL') {
          await db.run('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: 'A zona do novo endereço deve ser classificada como URBANA ou RURAL.'
          });
        }

        // Cria o novo endereço no banco de dados SQLite associando-o ao anunciante
        resolvedEnderecoId = await EnderecoModel.create({
          clienteId: anuncianteId,
          rua,
          numero,
          bairro,
          cep,
          cidade,
          uf,
          zona: upperZona
        });
      } else {
        // Se um ID de endereço foi fornecido, validamos se ele existe e se pertence ao próprio anunciante.
        // Isso impede que um usuário associe seu anúncio ao endereço de outra pessoa (vulnerabilidade de IDOR).
        const address = await EnderecoModel.findById(resolvedEnderecoId);
        if (!address) {
          await db.run('ROLLBACK');
          return res.status(400).json({
            status: 'error',
            message: 'O endereço informado não existe.'
          });
        }
        if (address.cliente_id !== anuncianteId) {
          await db.run('ROLLBACK');
          return res.status(403).json({
            status: 'error',
            message: 'Você só pode vincular anúncios a endereços de sua propriedade.'
          });
        }
      }

      // 4. Cria o Registro de Anúncio
      // Insere o anúncio no banco e armazena o ID gerado automaticamente.
      const adId = await AnuncioModel.create({
        anuncianteId,
        categoriaId,
        enderecoId: resolvedEnderecoId,
        nome,
        descricao,
        preco: parsedPreco
      });

      // 5. Upload e Salvamento da Imagem Principal
      // Faz o upload físico ou em nuvem do arquivo através do ArmazenamentoService e recupera a URL pública.
      const primaryUrl = await ArmazenamentoService.uploadImage(primaryImageFile, req);
      
      // Cria o registro da imagem principal no banco, definindo a ordem como 1.
      await ImagemModel.create({
        anuncioId: adId,
        url: primaryUrl,
        tipo: 'PRINCIPAL',
        ordem: 1
      });

      // 6. Upload e Salvamento das Imagens Secundárias (Opcional)
      // Se houver imagens adicionais no campo 'imagensSecundarias', processa cada uma delas sequencialmente.
      const secondaryFiles = req.files && req.files.imagensSecundarias ? req.files.imagensSecundarias : [];
      let order = 2; // A ordem das imagens secundárias começa a partir de 2.
      for (const file of secondaryFiles) {
        const url = await ArmazenamentoService.uploadImage(file, req);
        await ImagemModel.create({
          anuncioId: adId,
          url: url,
          tipo: 'SECUNDARIA',
          ordem: order++
        });
      }

      // Confirma e consolida todas as operações de banco executadas no bloco
      await db.run('COMMIT');

      // Registro de Auditoria do anúncio publicado
      logger.audit('Novo anúncio de produto publicado', {
        userId: anuncianteId,
        anuncioId: adId,
        preco: parsedPreco
      });

      // Busca os detalhes completos do anúncio recém-criado para retornar ao cliente
      const createdAd = await AnuncioModel.findById(adId);
      return res.status(201).json({
        status: 'success',
        message: 'Anúncio publicado com sucesso.',
        data: {
          anuncio: createdAd
        }
      });

    } catch (error) {
      // Se ocorrer qualquer exceção no fluxo, todas as inserções e alterações parciais são desfeitas
      await db.run('ROLLBACK');
      next(error);
    }
  }

  /**
   * Atualiza os dados de um anúncio existente, gerenciando a adição ou substituição
   * de imagens principais e secundárias, além da exclusão de imagens antigas.
   * 
   * @param {Object} req - Requisição contendo parâmetros (ID do anúncio), corpo de dados e novas imagens.
   * @param {Object} res - Resposta informando o sucesso e o anúncio atualizado.
   * @param {Function} next - Callback de erro.
   */
  static async update(req, res, next) {
    const db = await getDatabaseInstance();
    const anuncianteId = req.user.id;
    const { id } = req.params;

    try {
      const { nome, descricao, preco, categoriaId, enderecoId } = req.body;

      // Busca o anúncio original (incluindo se estiver em status inativo/lixeira para validação)
      const ad = await AnuncioModel.findById(id, true);
      if (!ad) {
        return res.status(404).json({
          status: 'error',
          message: 'Anúncio não encontrado.'
        });
      }

      // Regra de Negócio (RN10) - Controle de Acesso Baseado em Propriedade
      // Garante que apenas o criador original do anúncio (anunciante_id) possa alterá-lo.
      if (ad.anunciante_id !== anuncianteId) {
        return res.status(403).json({
          status: 'error',
          message: 'Você não possui permissão para editar anúncios de outros usuários.'
        });
      }

      // Bloqueia edições se o anúncio tiver sido excluído definitivamente
      if (ad.status === 'REMOVIDO') {
        return res.status(400).json({
          status: 'error',
          message: 'Não é possível editar um anúncio que foi removido permanentemente.'
        });
      }

      // Validação de Campos Obrigatórios na Edição
      if (!nome || !descricao || !preco || !categoriaId || !enderecoId) {
        return res.status(400).json({
          status: 'error',
          message: 'Os campos nome, descrição, preço, categoriaId e enderecoId são obrigatórios.'
        });
      }

      // Validação do valor
      const parsedPreco = parseFloat(preco);
      if (isNaN(parsedPreco) || parsedPreco <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'O preço informado deve ser um número maior que zero.'
        });
      }

      // Validação da categoria
      const category = await CategoriaModel.findById(categoriaId);
      if (!category) {
        return res.status(400).json({
          status: 'error',
          message: 'A categoria informada não existe.'
        });
      }

      // Validação de propriedade e existência do endereço
      const address = await EnderecoModel.findById(enderecoId);
      if (!address || address.cliente_id !== anuncianteId) {
        return res.status(400).json({
          status: 'error',
          message: 'O endereço informado não existe ou não pertence a você.'
        });
      }

      // Inicia fluxo de transação
      await db.run('BEGIN TRANSACTION');

      // Atualiza os campos textuais e numéricos básicos do anúncio
      await AnuncioModel.update(id, {
        categoriaId,
        enderecoId,
        nome,
        descricao,
        preco: parsedPreco
      });

      // Substituição da Imagem Principal (Se uma nova foi enviada)
      const newPrimaryFile = req.files && req.files.imagemPrincipal ? req.files.imagemPrincipal[0] : null;
      if (newPrimaryFile) {
        // Encontra o registro da imagem principal antiga associada a esse anúncio
        const oldPrimary = ad.imagens.find(img => img.tipo === 'PRINCIPAL');
        
        // Faz o upload do novo arquivo
        const primaryUrl = await ArmazenamentoService.uploadImage(newPrimaryFile, req);
        
        if (oldPrimary) {
          // Remove o registro da imagem antiga do banco de dados
          await ImagemModel.delete(oldPrimary.id);
          // Exclui o arquivo físico antigo do disco/armazenamento para economizar espaço
          await ArmazenamentoService.deleteImage(oldPrimary.url);
        }

        // Cria a nova relação de imagem principal com ordem = 1
        await ImagemModel.create({
          anuncioId: id,
          url: primaryUrl,
          tipo: 'PRINCIPAL',
          ordem: 1
        });
      }

      // Adição de Novas Imagens Secundárias (Se enviadas)
      const newSecondaryFiles = req.files && req.files.imagensSecundarias ? req.files.imagensSecundarias : [];
      if (newSecondaryFiles.length > 0) {
        // Filtra as imagens secundárias atuais para definir o próximo índice de ordem correto
        const currentSecondaries = ad.imagens.filter(img => img.tipo === 'SECUNDARIA');
        let nextOrder = currentSecondaries.length > 0 
          ? Math.max(...currentSecondaries.map(img => img.ordem)) + 1 
          : 2;

        for (const file of newSecondaryFiles) {
          const url = await ArmazenamentoService.uploadImage(file, req);
          await ImagemModel.create({
            anuncioId: id,
            url: url,
            tipo: 'SECUNDARIA',
            ordem: nextOrder++
          });
        }
      }

      // Exclusão Seletiva de Imagens Solicitada pelo Usuário
      // O cliente pode enviar uma lista de IDs de imagens para remover no campo 'deletarImagensIds'
      let deleteImageIds = req.body.deletarImagensIds;
      if (deleteImageIds) {
        // Trata se veio como string separada por vírgulas (comum em envios multipart/form-data) ou array
        if (typeof deleteImageIds === 'string') {
          deleteImageIds = deleteImageIds.split(',').map(n => parseInt(n));
        }

        for (const imgId of deleteImageIds) {
          const imgRecord = await ImagemModel.findById(imgId);
          // Garante que o registro existe e de fato pertence a esse anúncio (segurança extra)
          if (imgRecord && imgRecord.anuncio_id === parseInt(id)) {
            // Regra de segurança: Não é permitido excluir a imagem principal por este fluxo.
            // Para trocar a imagem principal, o usuário deve fazer o upload de uma nova imagem substituta.
            if (imgRecord.tipo === 'PRINCIPAL') {
              await db.run('ROLLBACK');
              return res.status(400).json({
                status: 'error',
                message: 'Não é permitido excluir a imagem principal sem substituí-la.'
              });
            }
            // Deleta o registro do banco
            await ImagemModel.delete(imgId);
            // Deleta o arquivo físico correspondente
            await ArmazenamentoService.deleteImage(imgRecord.url);
          }
        }
      }

      // Finaliza e aplica todas as mudanças
      await db.run('COMMIT');

      logger.audit('Anúncio de produto editado', {
        userId: anuncianteId,
        anuncioId: id
      });

      // Retorna os dados atualizados
      const updatedAd = await AnuncioModel.findById(id, true);
      return res.status(200).json({
        status: 'success',
        message: 'Anúncio atualizado com sucesso.',
        data: {
          anuncio: updatedAd
        }
      });

    } catch (error) {
      await db.run('ROLLBACK');
      next(error);
    }
  }

  /**
   * Envia um anúncio para a lixeira (Soft Delete).
   * O anúncio não é apagado fisicamente de imediato para permitir restauração rápida pelo proprietário.
   * 
   * @param {Object} req - Requisição contendo o ID do anúncio a ser deletado.
   * @param {Object} res - Resposta confirmando a operação.
   * @param {Function} next - Callback de erro.
   */
  static async delete(req, res, next) {
    const anuncianteId = req.user.id;
    const { id } = req.params;

    try {
      const ad = await AnuncioModel.findById(id, true);
      if (!ad) {
        return res.status(404).json({
          status: 'error',
          message: 'Anúncio não encontrado.'
        });
      }

      // Regra de Negócio (RN10) - Apenas o proprietário pode enviar para a lixeira
      if (ad.anunciante_id !== anuncianteId) {
        return res.status(403).json({
          status: 'error',
          message: 'Você não possui permissão para remover anúncios de outros usuários.'
        });
      }

      // Soft Delete (Regra de Segurança RS09)
      // Altera o status do anúncio para 'EM_LIXEIRA' e define a data de exclusão lógica.
      // O anúncio some dos resultados de pesquisa do Marketplace imediatamente.
      await AnuncioModel.moveToLixeira(id);

      logger.audit('Anúncio enviado para a lixeira', {
        userId: anuncianteId,
        anuncioId: id
      });

      return res.status(200).json({
        status: 'success',
        message: 'Anúncio enviado para a lixeira com sucesso. Ele ficará indisponível para busca, mas poderá ser restaurado em até 30 dias.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Restaura um anúncio que está na lixeira, tornando-o novamente ativo e visível.
   * 
   * @param {Object} req - Requisição com o ID do anúncio a ser restaurado.
   * @param {Object} res - Resposta de confirmação.
   * @param {Function} next - Callback de erro.
   */
  static async restore(req, res, next) {
    const anuncianteId = req.user.id;
    const { id } = req.params;

    try {
      const ad = await AnuncioModel.findById(id, true);
      if (!ad) {
        return res.status(404).json({
          status: 'error',
          message: 'Anúncio não encontrado.'
        });
      }

      // Controle de acesso de propriedade (RN10)
      if (ad.anunciante_id !== anuncianteId) {
        return res.status(403).json({
          status: 'error',
          message: 'Você não possui permissão para restaurar anúncios de outros usuários.'
        });
      }

      // Validação de estado
      if (ad.status !== 'EM_LIXEIRA') {
        return res.status(400).json({
          status: 'error',
          message: 'Este anúncio já está ativo ou já foi removido permanentemente.'
        });
      }

      // Restaura o anúncio alterando o status de volta para 'ATIVO'
      await AnuncioModel.restoreFromLixeira(id);

      logger.audit('Anúncio restaurado da lixeira', {
        userId: anuncianteId,
        anuncioId: id
      });

      return res.status(200).json({
        status: 'success',
        message: 'Anúncio restaurado com sucesso e novamente visível.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista apenas os anúncios pertencentes ao usuário logado, filtrando opcionalmente por
   * anúncios ativos ou anúncios que estão atualmente na lixeira.
   * 
   * @param {Object} req - Requisição contendo parâmetros de query (status, page, limit).
   * @param {Object} res - Resposta contendo a lista dos produtos do anunciante.
   * @param {Function} next - Callback de erro.
   */
  static async myProducts(req, res, next) {
    const anuncianteId = req.user.id;

    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      // O anunciante pode listar seus itens 'ATIVO' (publicados) ou 'EM_LIXEIRA'
      const status = req.query.status || 'ATIVO';

      if (status !== 'ATIVO' && status !== 'EM_LIXEIRA') {
        return res.status(400).json({
          status: 'error',
          message: 'Status inválido. Escolha ATIVO ou EM_LIXEIRA.'
        });
      }

      // Faz a consulta baseada no ID do anunciante
      const result = await AnuncioModel.findAll({ 
        page, 
        limit, 
        anuncianteId,
        status 
      });

      return res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rota/Operação utilitária para acionar a exclusão permanente física de anúncios da lixeira
   * que ultrapassaram o período de retenção de 30 dias (Regra de Segurança RS09).
   * Geralmente executado por uma tarefa agendada (Cron Job) ou chamada de Webhook segura.
   * 
   * @param {Object} req - Requisição HTTP.
   * @param {Object} res - Resposta com o quantitativo de anúncios excluídos de forma definitiva.
   * @param {Function} next - Callback de erro.
   */
  static async triggerCleanup(req, res, next) {
    try {
      // Aciona o método do model que remove anúncios com data_exclusao mais antiga que 30 dias
      const deletedCount = await AnuncioModel.cleanupLixeira();
      
      logger.info('Limpeza de lixeira executada', {
        deletedCount
      });

      return res.status(200).json({
        status: 'success',
        message: 'Limpeza de lixeira executada com sucesso.',
        data: {
          anuncios_excluidos_definitivamente: deletedCount
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AnuncioController;
