# Crunch System — Setup

## 1. Instalar dependências

```bash
cd crunch-system
npm install
```

## 2. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Copie a **URL** e a **anon key** (Settings > API)
3. Crie o arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

## 3. Criar tabelas no banco

1. No Dashboard do Supabase, vá em **SQL Editor**
2. Clique em **New Query**
3. Cole todo o conteúdo de `supabase/migration.sql`
4. Clique em **Run**

## 4. Criar bucket de Storage

1. No Dashboard, vá em **Storage**
2. Clique em **New Bucket**
3. Nome: `xml-notas`
4. Marque como **Public**
5. Salve

## 5. Rodar o projeto

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## 6. Deploy na Vercel

1. Push o código para o GitHub
2. Conecte o repo na [Vercel](https://vercel.com)
3. Adicione as variáveis de ambiente (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY)
4. Deploy

## Estrutura

```
crunch-system/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Hub principal
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── upload-xml/page.tsx   ← Upload de XML
│   │   ├── estoque/page.tsx      ← Estoque + FULL
│   │   └── api/upload-xml/route.ts
│   ├── components/
│   │   ├── NotasEmTransito.tsx
│   │   ├── XmlViewer.tsx
│   │   └── ConfirmModal.tsx
│   ├── services/
│   │   ├── notas-fiscais.ts
│   │   ├── estoque.ts
│   │   └── full.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── xml-parser.ts
│   │   └── business-days.ts
│   └── types/
│       └── index.ts
├── supabase/
│   └── migration.sql             ← SQL completo do banco
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Logo

Coloque o arquivo `crunch logo.png` em `public/crunch-logo.png`.
