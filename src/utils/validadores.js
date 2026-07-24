/**
 * @file validadores.js
 * @description Centralizador de funções de validação de dados de entrada do Agrostand.
 * Este arquivo reúne utilitários para validar formatos de strings importantes fornecidos
 * pelos usuários, como senhas fortes, endereços de e-mail e números de telefone.
 * 
 * Papel no fluxo de negócios:
 * - A validação de entrada é a primeira linha de defesa contra dados maliciosos, inconsistentes ou corrompidos.
 * - Ela impede que e-mails inválidos sejam cadastrados (o que quebraria o serviço de recuperação de senha),
 *   garante que o telefone do vendedor do WhatsApp possa ser formatado corretamente para links wa.me,
 *   e assegura que as senhas cadastradas tenham a complexidade mínima exigida para proteger as contas
 *   dos usuários contra ataques de força bruta.
 */

/**
 * Valida a força de uma senha de acordo com o Requisito do Sistema RS07.
 * Critérios obrigatórios:
 * - Pelo menos 8 caracteres.
 * - Pelo menos uma letra maiúscula.
 * - Pelo menos uma letra minúscula.
 * - Pelo menos um dígito numérico.
 * - Pelo menos um caractere especial (símbolo).
 * 
 * @param {string} password - Senha digitada pelo usuário no cadastro/alteração.
 * @returns {boolean} True se a senha atende a todos os critérios de segurança, caso contrário False.
 */
function validatePassword(password) {
  // Se a senha for nula, indefinida ou tiver comprimento inferior a 8, rejeita de imediato
  if (!password || password.length < 8) return false;
  
  // Utiliza expressões regulares (RegEx) para verificar a presença dos padrões obrigatórios:
  const hasUppercase = /[A-Z]/.test(password);     // Contém pelo menos uma letra maiúscula
  const hasLowercase = /[a-z]/.test(password);     // Contém pelo menos uma letra minúscula
  const hasDigit = /[0-9]/.test(password);         // Contém pelo menos um número (0-9)
  
  // Qualquer caractere que NÃO seja uma letra do alfabeto ou número é considerado especial.
  // O circunflexo '^' dentro de colchetes indica negação: tudo que não for A-Z, a-z ou 0-9.
  const hasSpecial = /[^A-Za-z0-9]/.test(password); 

  // A senha só será válida se passar em todos os cinco testes cumulativos
  return hasUppercase && hasLowercase && hasDigit && hasSpecial;
}

/**
 * Valida o formato de um endereço de e-mail.
 * 
 * @param {string} email - Endereço de e-mail enviado na requisição.
 * @returns {boolean} True se o formato do e-mail for válido, caso contrário False.
 */
function validateEmail(email) {
  if (!email) return false;
  
  // Expressão regular baseada na especificação simplificada do padrão RFC 5322.
  // Verifica se existe uma parte de usuário, o caractere '@', um domínio e uma extensão de domínio válida (ex: .com, .com.br).
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Valida o formato do telefone fornecido pelo usuário.
 * 
 * @param {string} phone - Telefone enviado no cadastro (geralmente formatado ou não).
 * @returns {boolean} True se o número de telefone contiver entre 10 e 15 dígitos numéricos limpos.
 */
function validatePhone(phone) {
  if (!phone) return false;
  
  // Limpa a string do telefone removendo tudo que não for número.
  // O modificador '\D' busca caracteres não-numéricos, e o flag 'g' garante a substituição global (todos).
  const digits = phone.replace(/\D/g, '');
  
  // Verifica se o comprimento está dentro dos limites aceitos no Brasil e internacionalmente.
  // 10 dígitos: (DDD de 2 dígitos) + 8 dígitos (fixo)
  // 11 dígitos: (DDD de 2 dígitos) + 9 dígitos (celular brasileiro)
  // 10 a 15 dígitos cobre números de telefone internacionais com códigos de país diversos.
  return digits.length >= 10 && digits.length <= 15;
}

module.exports = {
  validatePassword,
  validateEmail,
  validatePhone
};
