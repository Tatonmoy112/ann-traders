export type { Database, Json } from './database.types';
import type { Database } from './database.types';
export type Product = Database['public']['Tables']['products']['Row'];
export type Inquiry = Database['public']['Tables']['inquiries']['Row'];
export type Profile = Database['public']['Tables']['admin_profiles']['Row'];
export { masters, relations } from './catalog-config';
export type { FieldConfig, ModuleConfig } from './catalog-config';
