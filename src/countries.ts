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
