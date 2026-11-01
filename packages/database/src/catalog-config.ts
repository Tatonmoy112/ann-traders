export type FieldConfig = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'boolean' | 'number' | 'date' | 'select' | 'image';
  required?: boolean;
  options?: string[];
  lookup?: string;
  hint?: string;
};
export type ModuleConfig = {
  title: string;
  singular: string;
  description: string;
  fields: FieldConfig[];
};
const name: FieldConfig = { key: 'name', label: 'Name', required: true };
const slug: FieldConfig = {
  key: 'slug',
  label: 'Slug',
  required: true,
  hint: 'Stable lowercase URL identifier',
};
const description: FieldConfig = { key: 'description', label: 'Description', type: 'textarea' };
const active: FieldConfig = { key: 'is_active', label: 'Active', type: 'boolean' };
export const masters: Record<string, ModuleConfig> = {
  categories: {
    title: 'Categories',
    singular: 'category',
    description: 'Organize the catalog and its specification requirements.',
    fields: [
      name,
      slug,
      { key: 'parent_id', label: 'Parent category', lookup: 'categories' },
      {
        key: 'image_path',
        label: 'Category image / banner',
        type: 'image',
        hint: 'Upload category header or banner image',
      },
      description,
      { key: 'sort_order', label: 'Sort order', type: 'number' },
      active,
      { key: 'requires_composition', label: 'Requires 100% fiber composition', type: 'boolean' },
    ],
  },
  brands: {
    title: 'Brands',
    singular: 'brand',
    description: 'Manufacturers and brands represented in your catalog.',
    fields: [
      name,
      slug,
      {
        key: 'logo_path',
        label: 'Brand logo',
        type: 'image',
        hint: 'Upload brand logo (JPEG, PNG, WebP)',
      },
      description,
      { key: 'website_url', label: 'Website (HTTPS)' },
      { key: 'country_code', label: 'Country code', hint: 'Two-letter ISO code' },
      active,
    ],
  },
  units: {
    title: 'Units',
    singular: 'unit',
    description: 'Keep quantity, measurement, and price units precise.',
    fields: [
      name,
      { key: 'code', label: 'Code', required: true },
      { key: 'symbol', label: 'Symbol', required: true },
      {
        key: 'unit_family',
        label: 'Family',
        type: 'select',
        options: [
          'mass',
          'length',
          'volume',
          'count',
          'areal_density',
          'other',
          'area',
          'power',
          'electric_potential',
          'frequency',
          'time',
          'temperature',
          'ratio',
        ],
        required: true,
      },
      {
        key: 'factor_to_base',
        label: 'Factor to base',
        hint: 'Decimal conversion factor within the same family',
      },
      active,
    ],
  },
  attribute_definitions: {
    title: 'Attributes',
    singular: 'attribute',
    description: 'Typed technical specifications for every product category.',
    fields: [
      name,
      { key: 'code', label: 'Code', required: true },
      {
        key: 'data_type',
        label: 'Data type',
        type: 'select',
        options: ['text', 'number', 'boolean', 'select', 'multi_select'],
        required: true,
      },
      { key: 'default_unit_id', label: 'Default unit', lookup: 'units' },
      { key: 'is_filterable', label: 'Filterable', type: 'boolean' },
      { key: 'is_searchable', label: 'Searchable', type: 'boolean' },
      { key: 'is_variant_axis', label: 'Variant axis', type: 'boolean' },
      active,
      { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
  },
  attribute_options: {
    title: 'Attribute options',
    singular: 'option',
    description: 'Controlled values for select and multi-select specifications.',
    fields: [
      { key: 'attribute_id', label: 'Attribute', lookup: 'attribute_definitions', required: true },
      { key: 'value', label: 'Value', required: true },
      { key: 'label', label: 'Display label', required: true },
      { key: 'color_hex', label: 'Color hex' },
      active,
      { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
  },
  category_attributes: {
    title: 'Category specifications',
    singular: 'mapping',
    description: 'Define which product and variant specifications are required.',
    fields: [
      { key: 'category_id', label: 'Category', lookup: 'categories', required: true },
      { key: 'attribute_id', label: 'Attribute', lookup: 'attribute_definitions', required: true },
      {
        key: 'applies_to',
        label: 'Applies to',
        type: 'select',
        options: ['product', 'variant'],
        required: true,
      },
      { key: 'is_required', label: 'Required', type: 'boolean' },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
  },
  industries: {
    title: 'Industries',
    singular: 'industry',
    description: 'Industrial sectors served by the catalog.',
    fields: [name, slug, description, active],
  },
  applications: {
    title: 'Applications',
    singular: 'application',
    description: 'Practical uses and applications for catalog products.',
    fields: [name, slug, description],
  },
  certifications: {
    title: 'Certifications',
    singular: 'certification',
    description: 'Standards, certifications, and their issuing organizations.',
    fields: [name, { key: 'issuing_organization', label: 'Issuing organization' }, description],
  },
  fibers: {
    title: 'Fibers',
    singular: 'fiber',
    description: 'Composition vocabulary for textile variants.',
    fields: [name, { key: 'code', label: 'Code', required: true }, active],
  },
  equipment_models: {
    title: 'Equipment models',
    singular: 'equipment model',
    description: 'Machine models used for product compatibility.',
    fields: [
      { key: 'brand_id', label: 'Brand', lookup: 'brands', required: true },
      { key: 'model_name', label: 'Model name', required: true },
      { key: 'equipment_type', label: 'Equipment type' },
      description,
    ],
  },
};
export const relations: Record<string, ModuleConfig> = {
  product_extra_categories: {
    title: 'Additional categories',
    singular: 'category',
    description: 'Additional placements beyond the primary category.',
    fields: [{ key: 'category_id', label: 'Category', lookup: 'categories', required: true }],
  },
  product_attribute_values: {
    title: 'Product specifications',
    singular: 'specification',
    description:
      'Set one typed value per scalar attribute; use separate option rows for multi-select.',
    fields: [
      { key: 'attribute_id', label: 'Attribute', lookup: 'attribute_definitions', required: true },
      { key: 'option_id', label: 'Option', lookup: 'attribute_options' },
      { key: 'value_text', label: 'Text value' },
      { key: 'value_number', label: 'Numeric value' },
      { key: 'value_boolean', label: 'Boolean value', type: 'select', options: ['true', 'false'] },
      { key: 'unit_id', label: 'Unit', lookup: 'units' },
    ],
  },
  variant_attribute_values: {
    title: 'Variant specifications',
    singular: 'specification',
    description: 'Technical values for each individual SKU.',
    fields: [
      { key: 'variant_id', label: 'Variant', lookup: 'product_variants', required: true },
      { key: 'attribute_id', label: 'Attribute', lookup: 'attribute_definitions', required: true },
      { key: 'option_id', label: 'Option', lookup: 'attribute_options' },
      { key: 'value_text', label: 'Text value' },
      { key: 'value_number', label: 'Numeric value' },
      { key: 'value_boolean', label: 'Boolean value', type: 'select', options: ['true', 'false'] },
      { key: 'unit_id', label: 'Unit', lookup: 'units' },
    ],
  },
  variant_packaging: {
    title: 'Packaging',
    singular: 'pack',
    description: 'Rolls, bags, boxes, drums, and cartons with explicit quantities.',
    fields: [
      { key: 'variant_id', label: 'Variant', lookup: 'product_variants', required: true },
      { key: 'packaging_type', label: 'Pack type', required: true },
      { key: 'pack_quantity', label: 'Pack quantity', required: true },
      { key: 'pack_unit_id', label: 'Unit', lookup: 'units', required: true },
      { key: 'package_description', label: 'Description', type: 'textarea' },
      { key: 'is_default', label: 'Default pack', type: 'boolean' },
    ],
  },
  price_tiers: {
    title: 'Price tiers',
    singular: 'tier',
    description:
      'Quantity ranges use inclusive minimum and exclusive maximum. Leave the last maximum empty.',
    fields: [
      { key: 'variant_price_id', label: 'Price record', lookup: 'variant_prices', required: true },
      { key: 'min_quantity', label: 'Minimum quantity', required: true },
      { key: 'max_quantity', label: 'Maximum quantity' },
      { key: 'quantity_unit_id', label: 'Quantity unit', lookup: 'units', required: true },
      { key: 'unit_price', label: 'Unit price', required: true },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
  },
  product_industries: {
    title: 'Industries',
    singular: 'industry',
    description: 'Sectors this product serves.',
    fields: [{ key: 'industry_id', label: 'Industry', lookup: 'industries', required: true }],
  },
  product_applications: {
    title: 'Applications',
    singular: 'application',
    description: 'Uses of this product.',
    fields: [
      { key: 'application_id', label: 'Application', lookup: 'applications', required: true },
    ],
  },
  product_certifications: {
    title: 'Product certifications',
    singular: 'certification',
    description: 'Track certificates, expiry dates and supporting documents.',
    fields: [
      { key: 'certification_id', label: 'Certification', lookup: 'certifications', required: true },
      { key: 'certificate_number', label: 'Certificate number' },
      { key: 'valid_until', label: 'Valid until', type: 'date' },
      { key: 'document_id', label: 'Supporting document', lookup: 'product_documents' },
    ],
  },
  variant_fiber_composition: {
    title: 'Fiber composition',
    singular: 'component',
    description: 'Applicable active variants must total exactly 100% to publish.',
    fields: [
      { key: 'variant_id', label: 'Variant', lookup: 'product_variants', required: true },
      { key: 'fiber_id', label: 'Fiber', lookup: 'fibers', required: true },
      { key: 'percentage', label: 'Percentage', required: true },
    ],
  },
  variant_equipment_compatibility: {
    title: 'Equipment compatibility',
    singular: 'model',
    description: 'Compatible machine models for each SKU.',
    fields: [
      { key: 'variant_id', label: 'Variant', lookup: 'product_variants', required: true },
      { key: 'equipment_model_id', label: 'Equipment', lookup: 'equipment_models', required: true },
      { key: 'compatibility_notes', label: 'Notes', type: 'textarea' },
    ],
  },
};
