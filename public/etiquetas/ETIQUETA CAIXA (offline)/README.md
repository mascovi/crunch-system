# ETIQUETA CAIXA

Sistema interno de geração de ZPL para etiquetas térmicas (40 × 25 mm, dupla, 203 DPI).

## Como usar

Abra o arquivo `index.html` em qualquer navegador (Chrome, Edge, Firefox).
Não precisa de internet, servidor ou instalação.

O hub tem dois sistemas:

- **Etiquetas de Caixa** — para identificar caixas de estoque (produto, código, fornecedor). O ZPL é gerado dinamicamente.
- **Etiquetas de Produto** — etiquetas pré-prontas para anúncios/envio (com código de barras). Permite escolher quantidade total e ajustar margem/espaçamento.

## Adicionar novas etiquetas

No sistema **Etiquetas de Produto**, clique em **+ Nova etiqueta** (canto superior direito).

Há dois modos:

1. **Gerar a partir do modelo** (recomendado) — preencha fornecedor, código, descrição e SKU, e o sistema monta o ZPL automaticamente.
2. **Colar ZPL completo** — caso você já tenha o código pronto.

As etiquetas personalizadas ficam salvas no navegador (localStorage).

## Backup / Sincronização entre máquinas

O `localStorage` é por navegador / por computador. Para mover suas etiquetas personalizadas para outra máquina:

1. Em "+ Nova etiqueta" → aba **Minhas etiquetas** → **↓ Exportar backup**
2. Salve o JSON gerado
3. No outro computador, abra o sistema e use **↑ Importar backup**

## Especificações de impressão

- Formato: 40 × 25 mm
- Layout: 2 etiquetas lado a lado
- Resolução: 203 DPI (8 dots/mm)
- Encoding: UTF-8 (`^CI28`)
- Comando de quantidade: `^PQ`
- Offset vertical: `^LH0,8` (corrige corte no topo)
- Margem esquerda padrão: 0,5 mm
- Espaçamento padrão entre etiquetas: 0,5 mm

## Hospedar online (GitHub Pages)

1. Crie um repositório no GitHub
2. Faça upload destes 3 arquivos (`index.html`, `Gerador de Etiquetas.html`, `Etiquetas Prontas.html`)
3. Settings → Pages → Source: `main` branch → Save
4. Em ~1 minuto, sua URL fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`
