/**
 * @file AnuncioService.js
 * @description Camada de serviço: ciclo de vida dos anúncios.
 * Orquestra o agregado de domínio (`Anuncio` + `Produto` + `Imagem` + ...),
 * os DAOs e o upload de arquivos; lança erros de `src/errors`.
 *
 * Nota de transação (better-sqlite3 é síncrono):
 * - Todo I/O assíncrono (upload/remoção de arquivos) ocorre ANTES ou DEPOIS
 *   da transação, nunca dentro de `db.transaction((tx) => ...)`.
 * - `httpReq` (Express) é usado SOMENTE para descobrir protocolo/host na
 *   montagem da URL pública do upload — nada de HTTP além disso.
 */

const AnuncioDAO = require('../dao/AnuncioDAO');
const ImagemDAO = require('../dao/ImagemDAO');
const EnderecoDAO = require('../dao/EnderecoDAO');
const CategoriaDAO = require('../dao/CategoriaDAO');
const ArmazenamentoService = require('./armazenamentoService');
const { getDb } = require('../db');
const { generateWhatsAppLink } = require('../utils/whatsapp');
const logger = require('../utils/logger');
const {
  Anuncio,
  Produto,
  Imagem,
  Endereco,
  reconstituirAnunciante,
  reconstituirCategoria,
  reconstituirEndereco,
  reconstituirAgregadoAnuncio,
} = require('../domain/factories');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../errors/AppError');

class AnuncioService {
  static async list(query) {
    const parsedPage = parseInt(query.page) || 1;
    const parsedLimit = parseInt(query.limit) || 10;
    // Querystring usa `categoriaId` (PT); aceita `categoryId` (EN) como alias.
    const rawCategory = query.categoriaId ?? query.categoryId;
    const search = query.search || null;
    return AnuncioDAO.findAll({
      page: parsedPage,
      limit: parsedLimit,
      categoryId: rawCategory ? parseInt(rawCategory) : null,
      search,
      status: 'ATIVO',
    });
  }

  static async get({ id }) {
    const ad = await AnuncioDAO.findById(id);
    if (!ad) {
      throw new NotFoundError('Anúncio indisponível ou não encontrado.');
    }

    // RF07/RS01 — link WhatsApp (redação contratada na resposta da API).
    const whatsappMsg = `Olá ${ad.vendedor_nome}, vi seu anúncio do produto "${ad.nome}" por R$ ${ad.preco.toFixed(2)} no Marketplace e gostaria de negociar.`;
    const linkWhatsapp = generateWhatsAppLink(ad.vendedor_telefone, whatsappMsg);

    return {
      id: ad.id,
      nome: ad.nome,
      descricao: ad.descricao,
      preco: ad.preco,
      data_publicacao: ad.data_publicacao,
      status: ad.status,
      categoria: { id: ad.categoria_id, nome: ad.categoria_nome },
      localizacao: {
        id: ad.endereco_id,
        rua: ad.rua,
        numero: ad.numero,
        bairro: ad.bairro,
        cep: ad.cep,
        cidade: ad.cidade,
        uf: ad.uf,
        zona: ad.zona,
      },
      vendedor: {
        id: ad.anunciante_id,
        nome: `${ad.vendedor_nome} ${ad.vendedor_sobrenome}`,
        telefone: ad.vendedor_telefone,
        link_whatsapp: linkWhatsapp,
      },
      imagens: ad.imagens,
    };
  }

  static async create({ anunciantePublic, body, files, httpReq }) {
    const anuncianteId = anunciantePublic.id;
    const { nome, descricao, preco, categoriaId, enderecoId } = body;

    if (!nome || !descricao || !preco || !categoriaId) {
      throw new BadRequestError('Os campos nome, descrição, preço e categoriaId são obrigatórios.');
    }

    const parsedPreco = parseFloat(preco);
    if (isNaN(parsedPreco) || parsedPreco <= 0) {
      throw new BadRequestError('O preço informado deve ser um número maior que zero.');
    }

    const category = await CategoriaDAO.findById(categoriaId);
    if (!category) {
      throw new BadRequestError('A categoria informada não existe.');
    }

    // RN04 — imagem principal obrigatória
    const primaryImageFile = files && files.imagemPrincipal ? files.imagemPrincipal[0] : null;
    if (!primaryImageFile) {
      throw new BadRequestError('Todo anúncio deve conter obrigatoriamente uma imagem principal.');
    }

    // RN06 — resolve endereço (validação antes da tx; criação dentro da tx).
    // A presença dos campos do novo endereço é invariante da entidade Endereco.
    let resolvedEnderecoId = enderecoId ? parseInt(enderecoId) : null;
    let novoEnderecoEnt = null;
    let enderecoEnt = null;

    if (!resolvedEnderecoId) {
      const { rua, numero, bairro, cep, cidade, uf, zona } = body;
      novoEnderecoEnt = new Endereco({ clienteId: anuncianteId, rua, numero, bairro, cep, cidade, uf, zona });
      if (!novoEnderecoEnt.validar()) {
        throw new BadRequestError('Informe um enderecoId existente ou todos os campos para cadastrar um novo endereço para o anúncio.');
      }
      const upperZona = String(zona).toUpperCase();
      if (upperZona !== 'URBANA' && upperZona !== 'RURAL') {
        throw new BadRequestError('A zona do novo endereço deve ser classificada como URBANA ou RURAL.');
      }
      novoEnderecoEnt.zona = upperZona;
      enderecoEnt = novoEnderecoEnt;
    } else {
      const address = await EnderecoDAO.findById(resolvedEnderecoId);
      if (!address) {
        throw new BadRequestError('O endereço informado não existe.');
      }
      if (address.cliente_id !== anuncianteId) {
        throw new ForbiddenError('Você só pode vincular anúncios a endereços de sua propriedade.');
      }
      enderecoEnt = reconstituirEndereco(address);
    }

    // Uploads ANTES da tx (I/O assíncrono fora da transação síncrona)
    const primaryUrl = await ArmazenamentoService.uploadImage(primaryImageFile, httpReq);
    const secondaryFiles = files && files.imagensSecundarias ? files.imagensSecundarias : [];
    const secondaryUrls = [];
    for (const file of secondaryFiles) {
      secondaryUrls.push(await ArmazenamentoService.uploadImage(file, httpReq));
    }

    // Domínio: monta o agregado e publica via anunciante — `publicar()` barra
    // anúncios inconsistentes (sem produto/categoria/endereço/imagem).
    const anuncianteEnt = reconstituirAnunciante(anunciantePublic);
    const anuncioEnt = new Anuncio({
      produto: new Produto({ nome, descricao, preco: parsedPreco }),
      imagens: [
        new Imagem({ url: primaryUrl, tipo: 'PRINCIPAL', ordem: 1 }),
        ...secondaryUrls.map((url, i) => new Imagem({ url, tipo: 'SECUNDARIA', ordem: i + 2 })),
      ],
      anunciante: anuncianteEnt,
      categoria: reconstituirCategoria(category),
      endereco: enderecoEnt,
      status: 'ATIVO',
    });
    try {
      anuncianteEnt.publicarAnuncio(anuncioEnt);
    } catch (err) {
      throw new BadRequestError(err.message);
    }

    // Transação atômica: endereço (se novo) + anúncio + imagens, do estado da entidade
    const adId = getDb().transaction((tx) => {
      let enderecoFinal = resolvedEnderecoId;
      if (!enderecoFinal) {
        enderecoFinal = EnderecoDAO.create({
          clienteId: anuncianteId,
          rua: novoEnderecoEnt.rua,
          numero: novoEnderecoEnt.numero,
          bairro: novoEnderecoEnt.bairro,
          cep: novoEnderecoEnt.cep,
          cidade: novoEnderecoEnt.cidade,
          uf: novoEnderecoEnt.uf,
          zona: novoEnderecoEnt.zona,
        }, tx);
      }
      const id = AnuncioDAO.create({
        anuncianteId: anuncianteEnt.id,
        categoriaId,
        enderecoId: enderecoFinal,
        nome: anuncioEnt.produto.nome,
        descricao: anuncioEnt.produto.descricao,
        preco: anuncioEnt.produto.preco,
      }, tx);
      for (const img of anuncioEnt.imagens) {
        ImagemDAO.create({ anuncioId: id, url: img.url, tipo: img.tipo, ordem: img.ordem }, tx);
      }
      return id;
    });

    logger.audit('Novo anúncio de produto publicado', {
      userId: anuncianteId,
      anuncioId: adId,
      preco: parsedPreco,
    });

    return AnuncioDAO.findById(adId);
  }

  static async update({ anunciantePublic, id, body, files, httpReq }) {
    const anuncianteId = anunciantePublic.id;
    const { nome, descricao, preco, categoriaId, enderecoId } = body;

    const ad = await AnuncioDAO.findById(id, true);
    if (!ad) {
      throw new NotFoundError('Anúncio não encontrado.');
    }

    // RN10 — ownership
    if (ad.anunciante_id !== anuncianteId) {
      throw new ForbiddenError('Você não possui permissão para editar anúncios de outros usuários.');
    }

    if (ad.status === 'REMOVIDO') {
      throw new BadRequestError('Não é possível editar um anúncio que foi removido permanentemente.');
    }

    if (!nome || !descricao || !preco || !categoriaId || !enderecoId) {
      throw new BadRequestError('Os campos nome, descrição, preço, categoriaId e enderecoId são obrigatórios.');
    }

    const parsedPreco = parseFloat(preco);
    if (isNaN(parsedPreco) || parsedPreco <= 0) {
      throw new BadRequestError('O preço informado deve ser um número maior que zero.');
    }

    const category = await CategoriaDAO.findById(categoriaId);
    if (!category) {
      throw new BadRequestError('A categoria informada não existe.');
    }

    const address = await EnderecoDAO.findById(enderecoId);
    if (!address || address.cliente_id !== anuncianteId) {
      throw new BadRequestError('O endereço informado não existe ou não pertence a você.');
    }

    // Normaliza lista de exclusão (string "1,2" ou array — artefato do multipart)
    let deleteImageIds = body.deletarImagensIds;
    if (typeof deleteImageIds === 'string') {
      deleteImageIds = deleteImageIds.split(',').map((n) => parseInt(n)).filter(Number.isInteger);
    }
    deleteImageIds = Array.isArray(deleteImageIds) ? deleteImageIds.map(Number).filter(Number.isInteger) : [];

    // Validação antecipada: não permitir excluir PRINCIPAL sem substituir
    const newPrimaryFile = files && files.imagemPrincipal ? files.imagemPrincipal[0] : null;
    if (deleteImageIds.length > 0) {
      for (const imgId of deleteImageIds) {
        const rec = await ImagemDAO.findById(imgId);
        if (rec && rec.anuncio_id === parseInt(id) && rec.tipo === 'PRINCIPAL') {
          throw new BadRequestError('Não é permitido excluir a imagem principal sem substituí-la.');
        }
      }
    }

    // Uploads ANTES da tx
    let newPrimaryUrl = null;
    if (newPrimaryFile) {
      newPrimaryUrl = await ArmazenamentoService.uploadImage(newPrimaryFile, httpReq);
    }
    const newSecondaryFiles = files && files.imagensSecundarias ? files.imagensSecundarias : [];
    const newSecondaryUrls = [];
    for (const file of newSecondaryFiles) {
      newSecondaryUrls.push(await ArmazenamentoService.uploadImage(file, httpReq));
    }

    const oldPrimary = ad.imagens.find((img) => img.tipo === 'PRINCIPAL');
    const currentSecondaries = ad.imagens.filter((img) => img.tipo === 'SECUNDARIA');
    const nextOrderBase =
      currentSecondaries.length > 0 ? Math.max(...currentSecondaries.map((img) => img.ordem)) + 1 : 2;

    // Domínio: reconstitui o agregado no estado atual e aplica a edição nele —
    // `editar()` revalida as invariantes antes de qualquer escrita.
    const deleteIdSet = new Set(deleteImageIds);
    try {
      const agregadoAtual = reconstituirAgregadoAnuncio(ad, reconstituirAnunciante(anunciantePublic));
      agregadoAtual.editar({
        produto: new Produto({ id: Number(id), nome, descricao, preco: parsedPreco }),
        categoria: reconstituirCategoria(category),
        endereco: reconstituirEndereco(address),
        imagens: [
          ...ad.imagens
            .filter((img) => !deleteIdSet.has(img.id) && !(newPrimaryUrl && img.tipo === 'PRINCIPAL'))
            .map((img) => new Imagem({ id: img.id, url: img.url, tipo: img.tipo, ordem: img.ordem })),
          ...(newPrimaryUrl ? [new Imagem({ url: newPrimaryUrl, tipo: 'PRINCIPAL', ordem: 1 })] : []),
          ...newSecondaryUrls.map((url, i) => new Imagem({ url, tipo: 'SECUNDARIA', ordem: nextOrderBase + i })),
        ],
      });
    } catch (err) {
      if (err.expose) throw err;
      throw new BadRequestError(err.message);
    }

    // Coleta arquivos físicos a remover APÓS o commit
    const filesToDelete = [];

    getDb().transaction((tx) => {
      AnuncioDAO.update(id, {
        categoriaId, enderecoId, nome, descricao, preco: parsedPreco,
      }, tx);

      if (newPrimaryUrl) {
        if (oldPrimary) {
          ImagemDAO.delete(oldPrimary.id, tx);
          filesToDelete.push(oldPrimary.url);
        }
        ImagemDAO.create({ anuncioId: id, url: newPrimaryUrl, tipo: 'PRINCIPAL', ordem: 1 }, tx);
      }

      let nextOrder = nextOrderBase;
      for (const url of newSecondaryUrls) {
        ImagemDAO.create({ anuncioId: id, url, tipo: 'SECUNDARIA', ordem: nextOrder++ }, tx);
      }

      for (const imgId of deleteImageIds) {
        const rec = ImagemDAO.findById(imgId, tx);
        if (rec && rec.anuncio_id === parseInt(id) && rec.tipo !== 'PRINCIPAL') {
          ImagemDAO.delete(imgId, tx);
          filesToDelete.push(rec.url);
        }
      }
    });

    // Limpeza física pós-commit
    for (const url of filesToDelete) {
      await ArmazenamentoService.deleteImage(url);
    }

    logger.audit('Anúncio de produto editado', { userId: anuncianteId, anuncioId: id });

    return AnuncioDAO.findById(id, true);
  }

  static async remove({ anunciantePublic, id }) {
    const anuncianteId = anunciantePublic.id;

    const ad = await AnuncioDAO.findById(id, true);
    if (!ad) {
      throw new NotFoundError('Anúncio não encontrado.');
    }
    if (ad.anunciante_id !== anuncianteId) {
      throw new ForbiddenError('Você não possui permissão para remover anúncios de outros usuários.');
    }

    // Domínio: transição de estado na entidade (RS09 — soft delete)
    const anuncioEnt = reconstituirAgregadoAnuncio(ad, reconstituirAnunciante(anunciantePublic));
    anuncioEnt.moverParaLixeira();

    await AnuncioDAO.moveToLixeira(id);

    logger.audit('Anúncio enviado para a lixeira', { userId: anuncianteId, anuncioId: id });
  }

  static async restore({ anunciantePublic, id }) {
    const anuncianteId = anunciantePublic.id;

    const ad = await AnuncioDAO.findById(id, true);
    if (!ad) {
      throw new NotFoundError('Anúncio não encontrado.');
    }
    if (ad.anunciante_id !== anuncianteId) {
      throw new ForbiddenError('Você não possui permissão para restaurar anúncios de outros usuários.');
    }
    if (ad.status !== 'EM_LIXEIRA') {
      throw new BadRequestError('Este anúncio já está ativo ou já foi removido permanentemente.');
    }

    const anuncioEnt = reconstituirAgregadoAnuncio(ad, reconstituirAnunciante(anunciantePublic));
    anuncioEnt.restaurar();

    await AnuncioDAO.restoreFromLixeira(id);

    logger.audit('Anúncio restaurado da lixeira', { userId: anuncianteId, anuncioId: id });
  }

  static async myProducts({ anuncianteId, query }) {
    const parsedPage = parseInt(query.page) || 1;
    const parsedLimit = parseInt(query.limit) || 10;
    const status = query.status || 'ATIVO';

    if (status !== 'ATIVO' && status !== 'EM_LIXEIRA') {
      throw new BadRequestError('Status inválido. Escolha ATIVO ou EM_LIXEIRA.');
    }

    return AnuncioDAO.findAll({ page: parsedPage, limit: parsedLimit, anuncianteId, status });
  }

  static async triggerCleanup() {
    const deletedCount = await AnuncioDAO.cleanupLixeira();

    logger.info('Limpeza de lixeira executada', { deletedCount });

    return { anuncios_excluidos_definitivamente: deletedCount };
  }
}

module.exports = AnuncioService;
