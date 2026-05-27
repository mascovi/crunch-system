import { XMLParser } from 'fast-xml-parser'
import type { XMLParsedNF, XMLParsedItem } from '@/types'

/**
 * Parser de XML de Nota Fiscal Eletrônica (NF-e).
 * Extrai fornecedor, CNPJ, número, data, volumes, transportadora e itens com Código ML.
 */
export function parseNFeXML(xmlString: string): XMLParsedNF {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  })

  let parsed: Record<string, unknown>
  try {
    parsed = parser.parse(xmlString)
  } catch {
    throw new Error('XML inválida ou corrompida. Verifique o arquivo.')
  }

  // Navegar pela estrutura da NF-e
  const nfeProc = (parsed as Record<string, unknown>).nfeProc as Record<string, unknown> | undefined
  const NFe = nfeProc
    ? (nfeProc.NFe as Record<string, unknown>)
    : (parsed as Record<string, unknown>).NFe as Record<string, unknown>

  if (!NFe) {
    throw new Error('Estrutura de NF-e não encontrada no XML.')
  }

  const infNFe = NFe.infNFe as Record<string, unknown>
  if (!infNFe) {
    throw new Error('Dados da NF-e (infNFe) não encontrados.')
  }

  // Emitente (fornecedor)
  const emit = infNFe.emit as Record<string, unknown>
  if (!emit) throw new Error('Dados do emitente não encontrados.')

  const fornecedor = (emit.xNome as string) || 'Fornecedor não identificado'
  const cnpj = (emit.CNPJ as string) || ''

  // Identificação da NF
  const ide = infNFe.ide as Record<string, unknown>
  if (!ide) throw new Error('Dados de identificação da NF não encontrados.')

  const numero_nf = String(ide.nNF || '')
  const data_emissao = (ide.dhEmi as string)?.substring(0, 10) || ''

  // Transporte — transportadora e volumes
  const transp = infNFe.transp as Record<string, unknown>
  let volumes = 0
  let transportadora = ''
  if (transp) {
    // Transportadora
    const transporta = transp.transporta as Record<string, unknown>
    if (transporta) {
      transportadora = (transporta.xNome as string) || ''
    }
    // Volumes
    const vol = transp.vol as Record<string, unknown> | Record<string, unknown>[]
    if (Array.isArray(vol)) {
      volumes = vol.reduce((sum, v) => sum + (Number(v.qVol) || 0), 0)
    } else if (vol) {
      volumes = Number(vol.qVol) || 0
    }
  }

  // Produtos/Itens
  const det = infNFe.det
  const detArray = Array.isArray(det) ? det : det ? [det] : []

  if (detArray.length === 0) {
    throw new Error('Nenhum item encontrado na NF-e.')
  }

  const itens: XMLParsedItem[] = detArray.map((item: Record<string, unknown>) => {
    const prod = item.prod as Record<string, unknown>
    if (!prod) throw new Error('Dados do produto ausentes em um dos itens.')

    // Tentar extrair Código ML de vários campos possíveis
    const codigoML = extrairCodigoML(prod)

    return {
      codigo_ml: codigoML,
      produto: (prod.xProd as string) || 'Produto sem nome',
      quantidade: Number(prod.qCom) || 0,
      valor_unitario: Number(prod.vUnCom) || 0,
      valor_total: Number(prod.vProd) || 0,
    }
  })

  return {
    fornecedor,
    cnpj,
    numero_nf,
    data_emissao,
    volumes,
    transportadora,
    itens,
  }
}

/**
 * Tenta extrair o Código ML (MLB...) de vários campos do produto.
 * Procura em: cProd, cEAN, infAdProd, xProd
 */
function extrairCodigoML(prod: Record<string, unknown>): string {
  const campos = [
    prod.cProd,
    prod.cEAN,
    prod.cEANTrib,
    prod.infAdProd,
    prod.xProd,
  ]

  for (const campo of campos) {
    if (typeof campo === 'string') {
      // Procurar padrão MLB seguido de dígitos
      const match = campo.match(/MLB\d+/i)
      if (match) return match[0].toUpperCase()
    }
  }

  // Se não encontrou MLB, usar cProd como fallback
  const cProd = String(prod.cProd || '')
  if (cProd) return cProd

  return ''
}

/**
 * Valida se todos os itens possuem Código ML.
 */
export function validarCodigosML(itens: XMLParsedItem[]): string[] {
  const erros: string[] = []
  itens.forEach((item, index) => {
    if (!item.codigo_ml) {
      erros.push(`Item ${index + 1} ("${item.produto}") não possui Código ML identificável.`)
    }
  })
  return erros
}
