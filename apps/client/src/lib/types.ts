export interface ImageVariant {
  kind: 'thumbnail' | 'card' | 'detail';
  url: string;
  width: number;
  height: number;
  key: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  product_code: string;
  short_description: string | null;
  description: string | null;
  product_type: string;
  country_of_origin: string | null;
  is_featured: boolean;
  is_new_arrival: boolean;
  category_name: string;
  category_slug: string;
  brand_name: string | null;
  image_url: string | null;
  image_variants: ImageVariant[];
  image_key: string | null;
  published_at: string;
  updated_at: string;
}

export interface PriceTier {
  min_quantity: string;
  max_quantity: string | null;
  unit_price: string;
  unit: string;
}

export interface VariantPrice {
  id: string;
  currency: string;
  type: string;
  min: string | null;
  max: string | null;
  unit: string;
  trade_term: string | null;
  valid_until: string | null;
  tiers: PriceTier[];
}

export interface VariantSpecification {
  code: string;
  label: string;
  text: string | null;
  number: string | null;
  boolean: boolean | null;
  option: string | null;
  unit: string | null;
}

export interface CatalogVariant {
  id: string;
  product_id: string;
  sku: string;
  variant_name: string;
  model_number: string | null;
  manufacturer_part_number: string | null;
  sale_unit: string;
  minimum_order_qty: string;
  minimum_order_unit: string;
  monthly_supply_capacity: string;
  capacity_unit: string;
  lead_time_days: number | null;
  availability_status: string;
  is_default: boolean;
  prices: VariantPrice[];
  specifications: VariantSpecification[];
}

export interface CatalogDocument {
  id: string;
  product_id: string;
  variant_id: string | null;
  title: string;
  document_type: string;
  file_extension?: string | null;
  bytes?: number | null;
  download_url?: string;
  product_name?: string;
  product_code?: string;
  product_slug?: string;
}

export interface DocumentListResponse {
  documents: CatalogDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_path: string | null;
  sort_order: number;
  product_count?: number;
  children?: CatalogCategory[];
}

export interface CatalogBrand {
  id: string;
  name: string;
  slug: string;
  country_code: string | null;
  logo_path: string | null;
  product_count?: number;
}

export interface ProductDetailResponse {
  product: CatalogProduct;
  variants: CatalogVariant[];
  documents: CatalogDocument[];
  gallery?: ImageVariant[];
}

export interface ProductListResponse {
  products: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

