import { NextRequest, NextResponse } from 'next/server'
import { parseNFeXML, validarCodigosML } from '@/lib/xml-parser'

/**
 * POST /api/upload-xml
 * Recebe o conteúdo XML como text e retorna os dados parseados.
 * Útil caso queira processar server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    if (!body || body.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Conteúdo XML vazio.' },
        { status: 400 }
      )
    }

    // Parse da XML
    const parsed = parseNFeXML(body)

    // Validar códigos ML
    const warnings = validarCodigosML(parsed.itens)

    return NextResponse.json({
      success: true,
      data: parsed,
      warnings,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar XML.'
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
