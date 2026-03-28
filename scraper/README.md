# SahiDawai Scraper

Scrapes medicine data from 1mg, Netmeds, PharmEasy, Apollo, Truemeds, MedPlus.

## Setup

First run this SQL in Supabase to add the unique constraint needed for upserts:

```sql
alter table products add constraint products_brand_name_mrp_key unique (brand_name, mrp);
```

## Run scraper

```bash
# Scrape all medicines (takes ~2-3 hours)
npx ts-node scraper/scrape.ts

# Scrape specific medicines only
npx ts-node scraper/scrape.ts "Paracetamol" "Metformin" "Atorvastatin"
```

Output is saved to `scraper/output.json` after each medicine — safe to stop and resume.

## Import to database

```bash
NEXT_PUBLIC_SUPABASE_URL=https://lguzmlyrizeofghghiza.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<your-key> \
npx ts-node scraper/import-to-db.ts
```
