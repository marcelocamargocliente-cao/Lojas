export function onlyNumbers(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata em tempo real uma string de CPF (até 11 dígitos) ou CNPJ (a partir do 12º dígito).
 * CPF: 000.000.000-00
 * CNPJ: 00.000.000/0001-00
 */
export function formatarCpfCnpj(value: string): string {
  const digits = onlyNumbers(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
