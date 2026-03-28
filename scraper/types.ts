export interface ScrapedProduct {
  brand_name: string
  manufacturer: string
  composition_text_raw: string
  dosage_form: string
  unit_per_pack: number
  mrp: number
  is_generic: boolean
  is_jan_aushadhi: boolean
  source: string
  source_url?: string
}
