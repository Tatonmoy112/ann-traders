import { z } from 'zod';
export const uuid = z.uuid();
export const decimal = z
  .string()
  .regex(/^\d{1,14}(\.\d{1,4})?$/, 'Use a positive decimal with at most four decimal places');
export const optionalDecimal = decimal.nullable();
export const productInput = z.object({
  name: z.string().trim().min(2).max(255),
  product_code: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(280),
  primary_category_id: uuid.nullable(),
  brand_id: uuid.nullable(),
  product_type: z.enum(['physical', 'software', 'service']).default('physical'),
  short_description: z.string().max(2000).nullable(),
  description: z.string().max(50000).nullable(),
  country_of_origin: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  is_featured: z.boolean().default(false),
  is_new_arrival: z.boolean().default(false),
  seo_title: z.string().max(255).nullable(),
  seo_description: z.string().max(1000).nullable(),
});
export const variantInput = z.object({
  id: uuid,
  sku: z.string().trim().min(1).max(100),
  variant_name: z.string().trim().min(1).max(255),
  model_number: z.string().max(150).nullable(),
  base_unit_id: uuid.nullable(),
  minimum_order_qty: optionalDecimal,
  minimum_order_unit_id: uuid.nullable(),
  monthly_supply_capacity: optionalDecimal,
  capacity_unit_id: uuid.nullable(),
  lead_time_days: z.number().int().min(0).max(3650).nullable(),
  availability_status: z.enum([
    'in_stock',
    'out_of_stock',
    'made_to_order',
    'pre_order',
    'on_request',
  ]),
  is_default: z.boolean(),
  is_active: z.boolean(),
});
export const priceInput = z
  .object({
    id: uuid,
    variant_id: uuid,
    currency_code: z.enum(['BDT', 'USD']),
    price_type: z.enum(['fixed', 'range', 'on_request']),
    min_price: optionalDecimal,
    max_price: optionalDecimal,
    price_unit_id: uuid,
    trade_term: z.string().max(40),
    valid_from: z.iso.datetime(),
    valid_until: z.iso.datetime().nullable(),
    is_active: z.boolean(),
  })
  .superRefine((v, c) => {
    if (v.price_type === 'on_request' && (v.min_price !== null || v.max_price !== null))
      c.addIssue({ code: 'custom', message: 'On-request prices must not contain amounts' });
    if (v.price_type !== 'on_request' && (!v.min_price || Number(v.min_price) <= 0))
      c.addIssue({ code: 'custom', path: ['min_price'], message: 'A positive price is required' });
    if (v.price_type === 'fixed' && v.max_price !== null)
      c.addIssue({ code: 'custom', path: ['max_price'], message: 'Fixed price has no maximum' });
    if (v.price_type === 'range' && (!v.max_price || Number(v.max_price) < Number(v.min_price)))
      c.addIssue({
        code: 'custom',
        path: ['max_price'],
        message: 'Maximum must be at least minimum',
      });
    if (v.valid_until && v.valid_until <= v.valid_from)
      c.addIssue({ code: 'custom', path: ['valid_until'], message: 'End must follow start' });
  });
export const saveDraftInput = z
  .object({
    id: uuid,
    revision: z.number().int().positive(),
    product: productInput,
    variants: z.array(variantInput).max(100),
    prices: z.array(priceInput).max(500),
  })
  .superRefine((v, c) => {
    if (new Set(v.variants.map((x) => x.sku.toLowerCase())).size !== v.variants.length)
      c.addIssue({ code: 'custom', path: ['variants'], message: 'SKUs must be unique' });
    if (v.variants.filter((x) => x.is_default && x.is_active).length > 1)
      c.addIssue({
        code: 'custom',
        path: ['variants'],
        message: 'Choose one active default variant',
      });
    if (v.prices.some((x) => !v.variants.some((y) => y.id === x.variant_id)))
      c.addIssue({
        code: 'custom',
        path: ['prices'],
        message: 'Price belongs to a different product',
      });
  });
export const lifecycleInput = z.object({
  id: uuid,
  revision: z.number().int().positive(),
  action: z.enum(['publish', 'unpublish', 'archive', 'delete', 'restore']),
});
