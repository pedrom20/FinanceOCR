// Nomes a mostrar para os códigos de país (ISO 3166-1 alpha-2) mais comuns
// para quem compra em Portugal e países vizinhos. Um código fora desta
// lista mostra-se tal como veio (ex: "US") em vez de desaparecer.
export const COUNTRY_NAMES: Record<string, string> = {
  PT: 'Portugal',
  ES: 'Espanha',
  FR: 'França',
  DE: 'Alemanha',
  IT: 'Itália',
  GB: 'Reino Unido',
  NL: 'Países Baixos',
  BE: 'Bélgica',
  LU: 'Luxemburgo',
  AD: 'Andorra',
  CH: 'Suíça',
  IE: 'Irlanda',
};

export function countryLabel(code?: string): string {
  if (!code) return '';
  return COUNTRY_NAMES[code] ?? code;
}

/** Emoji de bandeira a partir do código ISO (ex: "ES" -> 🇪🇸) — construído a
 * partir dos "regional indicator symbols" do Unicode, por isso funciona para
 * qualquer código de 2 letras, não só os que estão em COUNTRY_NAMES. */
export function countryFlag(code?: string): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  const [a, b] = code.toUpperCase();
  return String.fromCodePoint(0x1f1e6 + a.charCodeAt(0) - 65, 0x1f1e6 + b.charCodeAt(0) - 65);
}

export function countryLabelWithFlag(code?: string): string {
  if (!code) return '';
  const flag = countryFlag(code);
  return flag ? `${flag} ${countryLabel(code)}` : countryLabel(code);
}
