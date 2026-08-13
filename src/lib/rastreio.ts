/**
 * Registro de transportadoras com pagina de rastreio.
 *
 * O rastreio automatico nao e possivel: os endpoints publicos das
 * transportadoras exigem token de reCAPTCHA a cada consulta, justamente
 * para impedir consulta automatizada. Entao o sistema abre a pagina
 * oficial e deixa os dados prontos para colar.
 *
 * Para adicionar uma transportadora nova, basta incluir uma entrada
 * abaixo — o botao aparece sozinho na tabela de notas em transito.
 */

export interface Transportadora {
  /** Nome exibido no botao/tooltip */
  nome: string
  /** Trechos que identificam a transportadora no campo `transportadora` da NF */
  identificadores: string[]
  /** URL da pagina de rastreio */
  url: string
  /** Como consultar naquele site — aparece no aviso da tela */
  instrucao: string
}

export const TRANSPORTADORAS: Transportadora[] = [
  {
    nome: 'Rodonaves',
    identificadores: ['RODONAVES', 'RTE'],
    url: 'https://rodonaves.com.br/rastreio-de-mercadoria',
    instrucao: 'Escolha "Nota fiscal", cole o CNPJ e digite o numero da NF.',
  },
]

/**
 * Descobre a transportadora a partir do nome que veio na NF.
 * Retorna null quando nao ha pagina de rastreio cadastrada.
 */
export function acharTransportadora(nome: string | null | undefined): Transportadora | null {
  if (!nome) return null
  const alvo = nome.toUpperCase()
  return (
    TRANSPORTADORAS.find((t) =>
      t.identificadores.some((id) => alvo.includes(id))
    ) || null
  )
}
