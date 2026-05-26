-- ============================================
-- CRUNCH SYSTEM — MIGRAÇÃO DO BANCO DE DADOS
-- ============================================
-- Execute este SQL no SQL Editor do Supabase
-- (Dashboard > SQL Editor > New Query)
-- ============================================

-- ============================================
-- 1. TABELA: notas_fiscais
-- ============================================
CREATE TABLE IF NOT EXISTS notas_fiscais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  numero_nf TEXT NOT NULL,
  data_emissao DATE NOT NULL,
  data_upload TIMESTAMPTZ DEFAULT NOW(),
  data_recebimento TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'EM_TRANSITO' CHECK (status IN ('EM_TRANSITO', 'ENTREGUE')),
  volumes INTEGER DEFAULT 0,
  xml_url TEXT,

  -- Prevenir NF duplicada do mesmo fornecedor
  UNIQUE (numero_nf, cnpj)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_nf_status ON notas_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_nf_data_emissao ON notas_fiscais(data_emissao);

-- ============================================
-- 2. TABELA: itens_nf
-- ============================================
CREATE TABLE IF NOT EXISTS itens_nf (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nf_id UUID NOT NULL REFERENCES notas_fiscais(id) ON DELETE CASCADE,
  codigo_ml TEXT NOT NULL,
  produto TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  valor_unitario NUMERIC(12, 2) DEFAULT 0,
  valor_total NUMERIC(12, 2) DEFAULT 0
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_itens_nf_id ON itens_nf(nf_id);
CREATE INDEX IF NOT EXISTS idx_itens_codigo_ml ON itens_nf(codigo_ml);

-- ============================================
-- 3. TABELA: estoque_movimentacoes
-- ============================================
CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_ml TEXT NOT NULL,
  produto TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  origem TEXT NOT NULL, -- 'NF_RECEBIMENTO' ou 'ENVIO_FULL'
  referencia_id UUID NOT NULL,
  data TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mov_codigo_ml ON estoque_movimentacoes(codigo_ml);
CREATE INDEX IF NOT EXISTS idx_mov_tipo ON estoque_movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_mov_data ON estoque_movimentacoes(data);

-- ============================================
-- 4. TABELA: envios_full
-- ============================================
CREATE TABLE IF NOT EXISTS envios_full (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_envio TIMESTAMPTZ DEFAULT NOW(),
  arquivo_csv TEXT,
  total_itens INTEGER NOT NULL DEFAULT 0,
  total_codigos INTEGER NOT NULL DEFAULT 0
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_envios_data ON envios_full(data_envio);

-- ============================================
-- 5. TABELA: envios_full_itens
-- ============================================
CREATE TABLE IF NOT EXISTS envios_full_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  envio_id UUID NOT NULL REFERENCES envios_full(id) ON DELETE CASCADE,
  codigo_ml TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0)
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_envios_itens_envio ON envios_full_itens(envio_id);

-- ============================================
-- 6. VIEW: saldo_estoque (cache/performance)
-- ============================================
CREATE OR REPLACE VIEW saldo_estoque AS
SELECT
  codigo_ml,
  MAX(produto) AS produto,
  SUM(CASE WHEN tipo = 'ENTRADA' THEN quantidade ELSE 0 END)
  - SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade ELSE 0 END) AS quantidade_disponivel,
  MAX(data) AS ultima_movimentacao
FROM estoque_movimentacoes
GROUP BY codigo_ml;

-- ============================================
-- 7. STORAGE BUCKET para XMLs
-- ============================================
-- Executar no Dashboard > Storage > New Bucket
-- Nome: xml-notas
-- Público: sim (para permitir download)

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================
-- Por enquanto, habilitar acesso total via anon key.
-- Quando auth for implementada, restringir por user.

ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_nf ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE envios_full ENABLE ROW LEVEL SECURITY;
ALTER TABLE envios_full_itens ENABLE ROW LEVEL SECURITY;

-- Policies temporárias (acesso total — substituir por auth depois)
CREATE POLICY "allow_all_notas" ON notas_fiscais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_itens" ON itens_nf FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_mov" ON estoque_movimentacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_envios" ON envios_full FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_envios_itens" ON envios_full_itens FOR ALL USING (true) WITH CHECK (true);
