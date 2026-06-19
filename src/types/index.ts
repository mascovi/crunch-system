// ============================================
// TIPOS PRINCIPAIS DO SISTEMA CRUNCH
// ============================================

export interface NotaFiscal {
  id: string
  fornecedor: string
  cnpj: string
  numero_nf: string
  data_emissao: string
  data_upload: string
  data_recebimento?: string
  status: 'EM_TRANSITO' | 'ENTREGUE'
  volumes: number
  xml_url?: string
  transportadora?: string
}

export interface ItemNF {
  id: string
  nf_id: string
  codigo_ml: string
  produto: string
  quantidade: number
  valor_unitario: number
  valor_total: number
}

export interface EstoqueMovimentacao {
  id: string
  codigo_ml: string
  produto: string
  tipo: 'ENTRADA' | 'SAIDA'
  quantidade: number
  origem: string // 'NF_RECEBIMENTO' | 'ENVIO_FULL' | 'AJUSTE_INICIAL'
  referencia_id: string
  data: string
  preco_compra?: number
  observacao?: string
}

export interface SaldoEstoque {
  codigo_ml: string
  produto: string
  quantidade_disponivel: number
  ultima_movimentacao: string
  fornecedor_principal: string
  preco_compra: number
}

export interface EnvioFull {
  id: string
  data_envio: string
  arquivo_csv?: string
  total_itens: number
  total_codigos: number
  codigo_envio_ml?: string
  numero_nf?: string
  data_envio_csv?: string
}

export interface EnvioFullItem {
  id: string
  envio_id: string
  codigo_ml: string
  quantidade: number
  descricao?: string
  fornecedor?: string
  variacao?: string
}

export interface Produto {
  id?: string
  codigo_ml: string
  descricao: string
  fornecedor: string
  codigo_fornecedor?: string
}

export interface Fornecedor {
  id: string
  razao_social: string
  nome_fantasia: string
  cnpj: string
  endereco: string
  telefone: string
  email: string
  observacoes: string
  created_at: string
}

export type MotivoAjuste =
  | 'DEVOLUCAO'
  | 'CONSUMO_PROPRIO'
  | 'PROBLEMA_ENTREGA'
  | 'EXTRAVIO'
  | 'CORRECAO_INVENTARIO'
  | 'OUTRO'

// ============================================
// TIPOS DO PARSER XML
// ============================================

export interface XMLParsedNF {
  fornecedor: string
  cnpj: string
  numero_nf: string
  data_emissao: string
  volumes: number
  transportadora: string
  itens: XMLParsedItem[]
}

export interface XMLParsedItem {
  codigo_ml: string
  produto: string
  quantidade: number
  valor_unitario: number
  valor_total: number
}

// ============================================
// TIPOS DO CSV FULL
// ============================================

export interface CSVFullItem {
  codigo_ml: string
  quantidade: number
  descricao?: string
  fornecedor?: string
  variacao?: string
}

export interface CSVFullHeader {
  data_envio: string       // "27/05/2026"
  numero_nf: string        // "218.354"
  codigo_envio_ml: string  // "65623092"
}

// ============================================
// TIPOS DE RESPOSTA DA API
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ============================================
// NOTA EM TRÂNSITO (com dias úteis calculados)
// ============================================

export interface NotaEmTransito extends NotaFiscal {
  dias_uteis: number
  itens?: ItemNF[]
}
