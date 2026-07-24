/**
 * @file whatsapp.js
 * @description Utilitário para geração de links diretos de conversa do WhatsApp no Agrostand.
 * Este arquivo contém o método auxiliar que converte um número de telefone salvo em um link
 * de clique para conversar do WhatsApp (Click to Chat), conforme as regras de negócio.
 * 
 * Papel no fluxo de negócios:
 * - O Agrostand é um marketplace agropecuário onde os compradores entram em contato direto com os 
 *   vendedores para negociar os produtos (Requisito do Sistema RS01: Botão do WhatsApp na página do produto).
 * - Este utilitário formata o telefone do vendedor para uma URL limpa (wa.me/55...) de forma que,
 *   ao clicar no botão da interface, o comprador seja redirecionado automaticamente para o chat
 *   com uma mensagem pré-definida de interesse no produto (ex: "Olá, tenho interesse no produto X...").
 */

/**
 * Formata um número de telefone e gera um link para contato via WhatsApp.
 * Atende ao requisito de formatação de telefones brasileiros e suporte a mensagens personalizadas.
 * 
 * @param {string} phone - Telefone bruto inserido pelo vendedor.
 * @param {string} [messageText=""] - Texto opcional para pré-carregar na conversa do WhatsApp.
 * @returns {string|null} Link final do WhatsApp (ex: https://wa.me/5511999999999?text=...) ou null se o telefone for vazio.
 */
function generateWhatsAppLink(phone, messageText = "") {
  // Retorna null caso o número de telefone não tenha sido fornecido
  if (!phone) return null;

  // Remove caracteres especiais, parênteses, hifens e espaços em branco da string.
  // '\D' busca tudo que não seja número e substitui por uma string vazia.
  let digits = phone.replace(/\D/g, '');

  // Regra de Negócio: Se o telefone for brasileiro e o usuário não incluiu o código do país '55'.
  // Telefones no Brasil possuem:
  // - 10 dígitos: DDD (2 dígitos) + Número Fixo (8 dígitos). Ex: 1133334444
  // - 11 dígitos: DDD (2 dígitos) + Número Celular (9 dígitos). Ex: 11999998888
  // Se possuir exatamente 10 ou 11 dígitos, acrescentamos o prefixo do Brasil '55' no início.
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  // Define a URL base do recurso "Click to Chat" oficial do WhatsApp
  const baseUrl = `https://wa.me/${digits}`;
  
  // Se houver uma mensagem personalizada de introdução à negociação, concatena na URL
  if (messageText) {
    // É obrigatório usar encodeURIComponent para converter caracteres especiais da mensagem
    // (como acentos, espaços, exclamações ou interrogações) em um formato seguro para URLs (URL Encoding)
    return `${baseUrl}?text=${encodeURIComponent(messageText)}`;
  }
  
  // Caso contrário, retorna apenas a URL de direcionamento simples
  return baseUrl;
}

module.exports = {
  generateWhatsAppLink
};
