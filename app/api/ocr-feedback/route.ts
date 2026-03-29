import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export interface OcrCorrectionPayload {
  session_id: string
  corrections: {
    ocr_text: string      // what Claude read from the image
    corrected_name: string // what the user confirmed/changed it to
    confidence: number     // Claude's original confidence
    was_changed: boolean   // user edited vs accepted as-is
  }[]
}

export async function POST(req: NextRequest) {
  try {
    const body: OcrCorrectionPayload = await req.json()
    if (!body.session_id || !Array.isArray(body.corrections)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const rows = body.corrections.map(c => ({
      session_id: body.session_id,
      ocr_text: c.ocr_text,
      corrected_name: c.corrected_name,
      confidence: c.confidence,
      was_changed: c.was_changed,
    }))

    // Fire-and-forget — table may not exist yet, that's OK
    void supabaseAdmin.from('ocr_corrections').insert(rows)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
