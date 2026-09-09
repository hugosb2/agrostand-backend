/**
 * @file AnuncioController.js
 * @description Thin adapter HTTP para o marketplace. Orquestração, agregado de
 * domínio, uploads e transações no AnuncioService.
 *
 * Nota (RF07/RS01): o link WhatsApp usa utils/whatsapp para preservar a
 * redação contratada na resposta da API.
 */

const AnuncioService = require('../services/AnuncioService');

class AnuncioController {
  /** GET / — lista pública paginada com filtros. */
  static async list(req, res, next) {
    try {
      const result = await AnuncioService.list(req.query);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  /** GET /:id — detalhe + link WhatsApp. */
  static async get(req, res, next) {
    try {
      const anuncio = await AnuncioService.get({ id: req.params.id });
      return res.status(200).json({ status: 'success', data: { anuncio } });
    } catch (error) {
      next(error);
    }
  }

  /** POST / — cria anúncio (multipart via Multer). */
  static async create(req, res, next) {
    try {
      const anuncio = await AnuncioService.create({
        anunciantePublic: req.user,
        body: req.body,
        files: req.files,
        httpReq: req,
      });
      return res.status(201).json({
        status: 'success',
        message: 'Anúncio publicado com sucesso.',
        data: { anuncio }
      });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /:id — edita anúncio do próprio anunciante. */
  static async update(req, res, next) {
    try {
      const anuncio = await AnuncioService.update({
        anunciantePublic: req.user,
        id: req.params.id,
        body: req.body,
        files: req.files,
        httpReq: req,
      });
      return res.status(200).json({
        status: 'success',
        message: 'Anúncio atualizado com sucesso.',
        data: { anuncio }
      });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /:id — soft delete (lixeira, RS09). */
  static async delete(req, res, next) {
    try {
      await AnuncioService.remove({ anunciantePublic: req.user, id: req.params.id });
      return res.status(200).json({
        status: 'success',
        message: 'Anúncio enviado para a lixeira com sucesso. Ele ficará indisponível para busca, mas poderá ser restaurado em até 30 dias.'
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /:id/restore — reativa anúncio da lixeira. */
  static async restore(req, res, next) {
    try {
      await AnuncioService.restore({ anunciantePublic: req.user, id: req.params.id });
      return res.status(200).json({
        status: 'success',
        message: 'Anúncio restaurado com sucesso e novamente visível.'
      });
    } catch (error) {
      next(error);
    }
  }

  /** GET /me/products — anúncios do anunciante logado. */
  static async myProducts(req, res, next) {
    try {
      const result = await AnuncioService.myProducts({ anuncianteId: req.user.id, query: req.query });
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  /** POST /cleanup — purga da lixeira +30 dias (CRON). */
  static async triggerCleanup(req, res, next) {
    try {
      const data = await AnuncioService.triggerCleanup();
      return res.status(200).json({
        status: 'success',
        message: 'Limpeza de lixeira executada com sucesso.',
        data
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AnuncioController;
