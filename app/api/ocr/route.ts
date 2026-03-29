import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `This is a prescription image. Extract the medicine names with their doses from the MEDICINES/NAME column only.

Return a JSON array of strings. Each string should be the brand name (or generic name) with the dose. Examples: "Amoxyclav 625", "Dompan 10mg", "Ibuprofen 200mg", "Sinarest Tablet".

Rules:
- Include the medicine name and dose/strength only
- Do NOT include composition details, instructions, or doctor notes
- If a brand name is present, prefer that over the generic/salt name
- Return valid JSON array only, nothing else

JSON array:`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ medicines: [] })

    const medicines = JSON.parse(jsonMatch[0]) as unknown
    if (!Array.isArray(medicines)) return NextResponse.json({ medicines: [] })

    const cleaned = medicines
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      .map(m => m.trim())

    return NextResponse.json({ medicines: cleaned })
  } catch (err) {
    console.error('Claude OCR error:', err)
    return NextResponse.json({ error: 'Failed to read prescription' }, { status: 500 })
  }
}
