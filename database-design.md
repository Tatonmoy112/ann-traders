# Textile & Garments Supply Product Catalog — Supabase Database Design

Database: PostgreSQL (Supabase)\
Architecture: Separate Admin Frontend + Customer Catalog Frontend\
Model: B2B Product Catalog with Variants, Specifications, Pricing, and Categories

The structure accommodates fabrics, dyes and chemicals, marker paper, machinery, CAD/CAM accessories, safety products, software, and industrial supplies identified in the reference websites.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.fabrix.com.bd\&sz=32)

Fabrix International

+4



## 1. Database entities and attributes

Notation: `PK` = Primary Key, `FK` = Foreign Key, `UQ` = Unique, `NN` = Not Null.

### A. Product classification

#### 1. `categories`

| Attribute   | Data Type    | Constraint                   |
| ----------- | ------------ | ---------------------------- |
| id          | UUID         | PK                           |
| parent_id   | UUID         | FK → categories.id, nullable |
| name        | VARCHAR(150) | NN                           |
| slug        | VARCHAR(180) | UQ, NN                       |
| description | TEXT         | Nullable                     |
| image_path  | TEXT         | Nullable                     |
| sort_order  | INTEGER      | Default 0                    |
| is_active   | BOOLEAN      | Default true                 |
| created_at  | TIMESTAMPTZ  | Default now()                |
| updated_at  | TIMESTAMPTZ  | Default now()                |

#### 2. `brands`

| Attribute    | Data Type    | Constraint    |
| ------------ | ------------ | ------------- |
| id           | UUID         | PK            |
| name         | VARCHAR(150) | NN            |
| slug         | VARCHAR(180) | UQ            |
| logo_path    | TEXT         | Nullable      |
| description  | TEXT         | Nullable      |
| website_url  | TEXT         | Nullable      |
| country_code | CHAR(2)      | Nullable      |
| is_active    | BOOLEAN      | Default true  |
| created_at   | TIMESTAMPTZ  | Default now() |

#### 3. `units`

| Attribute      | Data Type     | Constraint   |
| -------------- | ------------- | ------------ |
| id             | UUID          | PK           |
| name           | VARCHAR(100)  | NN           |
| code           | VARCHAR(30)   | UQ, NN       |
| symbol         | VARCHAR(20)   | NN           |
| unit_family    | VARCHAR(40)   | NN           |
| factor_to_base | NUMERIC(18,8) | Nullable     |
| is_active      | BOOLEAN       | Default true |

Example units: KG, Gram, MT, Yard, Meter, Inch, CM, Roll, Piece, Box, Liter, GSM, Set.

### B. Product management

#### 4. `products`

| Attribute           | Data Type    | Constraint                    |
| ------------------- | ------------ | ----------------------------- |
| id                  | UUID         | PK                            |
| primary_category_id | UUID         | FK → categories.id            |
| brand_id            | UUID         | FK → brands.id, nullable      |
| product_code        | VARCHAR(80)  | UQ, NN                        |
| name                | VARCHAR(255) | NN                            |
| slug                | VARCHAR(280) | UQ, NN                        |
| product_type        | VARCHAR(30)  | physical / software / service |
| short_description   | TEXT         | Nullable                      |
| description         | TEXT         | Nullable                      |
| key_features        | JSONB        | Nullable                      |
| country_of_origin   | CHAR(2)      | Nullable                      |
| is_featured         | BOOLEAN      | Default false                 |
| is_new_arrival      | BOOLEAN      | Default false                 |
| status              | VARCHAR(20)  | draft / published / archived  |
| seo_title           | VARCHAR(255) | Nullable                      |
| seo_description     | TEXT         | Nullable                      |
| sort_order          | INTEGER      | Default 0                     |
| published_at        | TIMESTAMPTZ  | Nullable                      |
| created_by          | UUID         | FK → admin_profiles.id        |
| updated_by          | UUID         | FK → admin_profiles.id        |
| created_at          | TIMESTAMPTZ  | Default now()                 |
| updated_at          | TIMESTAMPTZ  | Default now()                 |
| deleted_at          | TIMESTAMPTZ  | Nullable                      |

#### 5. `product_extra_categories`

| Attribute   | Data Type | Constraint             |
| ----------- | --------- | ---------------------- |
| product_id  | UUID      | PK, FK → products.id   |
| category_id | UUID      | PK, FK → categories.id |

Allows products to appear in multiple categories beyond their primary category.

#### 6. `product_variants`

| Attribute                | Data Type     | Constraint                                                       |
| ------------------------ | ------------- | ---------------------------------------------------------------- |
| id                       | UUID          | PK                                                               |
| product_id               | UUID          | FK → products.id, NN                                             |
| sku                      | VARCHAR(100)  | UQ, NN                                                           |
| variant_name             | VARCHAR(255)  | NN                                                               |
| model_number             | VARCHAR(150)  | Nullable                                                         |
| manufacturer_part_number | VARCHAR(150)  | Nullable                                                         |
| base_unit_id             | UUID          | FK → units.id                                                    |
| minimum_order_qty        | NUMERIC(18,4) | Nullable                                                         |
| minimum_order_unit_id    | UUID          | FK → units.id                                                    |
| monthly_supply_capacity  | NUMERIC(18,4) | Nullable                                                         |
| capacity_unit_id         | UUID          | FK → units.id                                                    |
| lead_time_days           | INTEGER       | Nullable                                                         |
| availability_status      | VARCHAR(30)   | in_stock / out_of_stock / made_to_order / pre_order / on_request |
| is_default               | BOOLEAN       | Default false                                                    |
| is_active                | BOOLEAN       | Default true                                                     |
| sort_order               | INTEGER       | Default 0                                                        |
| created_at               | TIMESTAMPTZ   | Default now()                                                    |
| updated_at               | TIMESTAMPTZ   | Default now()                                                    |

Design rule: Every product has at least one variant, including products sold in only one configuration.

### C. Dynamic product specifications

#### 7. `attribute_definitions`

| Attribute       | Data Type    | Constraint                                      |
| --------------- | ------------ | ----------------------------------------------- |
| id              | UUID         | PK                                              |
| name            | VARCHAR(150) | NN                                              |
| code            | VARCHAR(100) | UQ, NN                                          |
| data_type       | VARCHAR(20)  | text / number / boolean / select / multi_select |
| default_unit_id | UUID         | FK → units.id, nullable                         |
| is_filterable   | BOOLEAN      | Default false                                   |
| is_searchable   | BOOLEAN      | Default false                                   |
| is_variant_axis | BOOLEAN      | Default false                                   |
| is_active       | BOOLEAN      | Default true                                    |
| sort_order      | INTEGER      | Default 0                                       |

#### 8. `attribute_options`

| Attribute    | Data Type    | Constraint                    |
| ------------ | ------------ | ----------------------------- |
| id           | UUID         | PK                            |
| attribute_id | UUID         | FK → attribute_definitions.id |
| value        | VARCHAR(150) | NN                            |
| label        | VARCHAR(150) | NN                            |
| color_hex    | CHAR(7)      | Nullable                      |
| sort_order   | INTEGER      | Default 0                     |
| is_active    | BOOLEAN      | Default true                  |

#### 9. `category_attributes`

| Attribute    | Data Type   | Constraint                        |
| ------------ | ----------- | --------------------------------- |
| category_id  | UUID        | PK, FK → categories.id            |
| attribute_id | UUID        | PK, FK → attribute_definitions.id |
| applies_to   | VARCHAR(20) | PK; product / variant             |
| is_required  | BOOLEAN     | Default false                     |
| sort_order   | INTEGER     | Default 0                         |

#### 10. `product_attribute_values`

| Attribute     | Data Type     | Constraint                          |
| ------------- | ------------- | ----------------------------------- |
| id            | UUID          | PK                                  |
| product_id    | UUID          | FK → products.id                    |
| attribute_id  | UUID          | FK → attribute_definitions.id       |
| option_id     | UUID          | FK → attribute_options.id, nullable |
| value_text    | TEXT          | Nullable                            |
| value_number  | NUMERIC(18,4) | Nullable                            |
| value_boolean | BOOLEAN       | Nullable                            |
| unit_id       | UUID          | FK → units.id, nullable             |

#### 11. `variant_attribute_values`

| Attribute     | Data Type     | Constraint                          |
| ------------- | ------------- | ----------------------------------- |
| id            | UUID          | PK                                  |
| variant_id    | UUID          | FK → product_variants.id            |
| attribute_id  | UUID          | FK → attribute_definitions.id       |
| option_id     | UUID          | FK → attribute_options.id, nullable |
| value_text    | TEXT          | Nullable                            |
| value_number  | NUMERIC(18,4) | Nullable                            |
| value_boolean | BOOLEAN       | Nullable                            |
| unit_id       | UUID          | FK → units.id, nullable             |

For both value tables, exactly one value field should be populated per row. Multi-select attributes may have multiple option rows; single-value attributes must have one value per owner and attribute.

### D. Product pricing

#### 12. `variant_prices`

| Attribute     | Data Type     | Constraint                     |
| ------------- | ------------- | ------------------------------ |
| id            | UUID          | PK                             |
| variant_id    | UUID          | FK → product_variants.id       |
| currency_code | CHAR(3)       | BDT / USD / other ISO currency |
| price_type    | VARCHAR(20)   | fixed / range / on_request     |
| min_price     | NUMERIC(18,4) | Nullable                       |
| max_price     | NUMERIC(18,4) | Nullable                       |
| price_unit_id | UUID          | FK → units.id                  |
| trade_term    | VARCHAR(40)   | Nullable                       |
| valid_from    | TIMESTAMPTZ   | NN                             |
| valid_until   | TIMESTAMPTZ   | Nullable                       |
| is_active     | BOOLEAN       | Default true                   |
| created_at    | TIMESTAMPTZ   | Default now()                  |
| updated_at    | TIMESTAMPTZ   | Default now()                  |

#### 13. `price_tiers`

| Attribute        | Data Type     | Constraint             |
| ---------------- | ------------- | ---------------------- |
| id               | UUID          | PK                     |
| variant_price_id | UUID          | FK → variant_prices.id |
| min_quantity     | NUMERIC(18,4) | NN                     |
| max_quantity     | NUMERIC(18,4) | Nullable               |
| quantity_unit_id | UUID          | FK → units.id          |
| unit_price       | NUMERIC(18,4) | NN                     |
| sort_order       | INTEGER       | Default 0              |

#### 14. `variant_packaging`

| Attribute           | Data Type     | Constraint                       |
| ------------------- | ------------- | -------------------------------- |
| id                  | UUID          | PK                               |
| variant_id          | UUID          | FK → product_variants.id         |
| packaging_type      | VARCHAR(100)  | Roll / Bag / Box / Drum / Carton |
| pack_quantity       | NUMERIC(18,4) | NN                               |
| pack_unit_id        | UUID          | FK → units.id                    |
| package_description | TEXT          | Nullable                         |
| is_default          | BOOLEAN       | Default false                    |

### E. Product images and technical documents

#### 15. `product_media`

| Attribute    | Data Type    | Constraint                         |
| ------------ | ------------ | ---------------------------------- |
| id           | UUID         | PK                                 |
| product_id   | UUID         | FK → products.id                   |
| variant_id   | UUID         | FK → product_variants.id, nullable |
| media_type   | VARCHAR(20)  | image / video                      |
| storage_path | TEXT         | Nullable                           |
| external_url | TEXT         | Nullable                           |
| alt_text     | VARCHAR(255) | Nullable                           |
| is_primary   | BOOLEAN      | Default false                      |
| sort_order   | INTEGER      | Default 0                          |
| created_at   | TIMESTAMPTZ  | Default now()                      |

#### 16. `product_documents`

| Attribute      | Data Type    | Constraint                                                  |
| -------------- | ------------ | ----------------------------------------------------------- |
| id             | UUID         | PK                                                          |
| product_id     | UUID         | FK → products.id                                            |
| variant_id     | UUID         | FK → product_variants.id, nullable                          |
| title          | VARCHAR(255) | NN                                                          |
| document_type  | VARCHAR(50)  | catalogue / TDS / SDS / MSDS / certificate / manual / other |
| storage_path   | TEXT         | NN                                                          |
| file_extension | VARCHAR(15)  | Nullable                                                    |
| is_public      | BOOLEAN      | Default true                                                |
| sort_order     | INTEGER      | Default 0                                                   |
| created_at     | TIMESTAMPTZ  | Default now()                                               |

Use Supabase Storage for files and store their paths in PostgreSQL.

### F. Industry, application, and certification

#### 17. `industries`

| Attribute   | Data Type    | Constraint   |
| ----------- | ------------ | ------------ |
| id          | UUID         | PK           |
| name        | VARCHAR(150) | NN           |
| slug        | VARCHAR(180) | UQ           |
| description | TEXT         | Nullable     |
| is_active   | BOOLEAN      | Default true |

#### 18. `product_industries`

| Attribute   | Data Type | Constraint             |
| ----------- | --------- | ---------------------- |
| product_id  | UUID      | PK, FK → products.id   |
| industry_id | UUID      | PK, FK → industries.id |

#### 19. `applications`

| Attribute   | Data Type    | Constraint |
| ----------- | ------------ | ---------- |
| id          | UUID         | PK         |
| name        | VARCHAR(150) | NN         |
| slug        | VARCHAR(180) | UQ         |
| description | TEXT         | Nullable   |

#### 20. `product_applications`

| Attribute      | Data Type | Constraint               |
| -------------- | --------- | ------------------------ |
| product_id     | UUID      | PK, FK → products.id     |
| application_id | UUID      | PK, FK → applications.id |

#### 21. `certifications`

| Attribute            | Data Type    | Constraint |
| -------------------- | ------------ | ---------- |
| id                   | UUID         | PK         |
| name                 | VARCHAR(150) | UQ         |
| issuing_organization | VARCHAR(150) | Nullable   |
| description          | TEXT         | Nullable   |

#### 22. `product_certifications`

| Attribute          | Data Type    | Constraint                          |
| ------------------ | ------------ | ----------------------------------- |
| id                 | UUID         | PK                                  |
| product_id         | UUID         | FK → products.id                    |
| certification_id   | UUID         | FK → certifications.id              |
| certificate_number | VARCHAR(150) | Nullable                            |
| valid_until        | DATE         | Nullable                            |
| document_id        | UUID         | FK → product_documents.id, nullable |

### G. Textile composition and machine compatibility

#### 23. `fibers`

| Attribute | Data Type    | Constraint   |
| --------- | ------------ | ------------ |
| id        | UUID         | PK           |
| name      | VARCHAR(100) | NN           |
| code      | VARCHAR(30)  | UQ           |
| is_active | BOOLEAN      | Default true |

#### 24. `variant_fiber_composition`

| Attribute  | Data Type    | Constraint                   |
| ---------- | ------------ | ---------------------------- |
| variant_id | UUID         | PK, FK → product_variants.id |
| fiber_id   | UUID         | PK, FK → fibers.id           |
| percentage | NUMERIC(5,2) | CHECK 0–100                  |

For applicable fabric variants, composition percentages should total 100.

#### 25. `equipment_models`

| Attribute      | Data Type    | Constraint     |
| -------------- | ------------ | -------------- |
| id             | UUID         | PK             |
| brand_id       | UUID         | FK → brands.id |
| model_name     | VARCHAR(150) | NN             |
| equipment_type | VARCHAR(100) | Nullable       |
| description    | TEXT         | Nullable       |

#### 26. `variant_equipment_compatibility`

| Attribute           | Data Type | Constraint                   |
| ------------------- | --------- | ---------------------------- |
| variant_id          | UUID      | PK, FK → product_variants.id |
| equipment_model_id  | UUID      | PK, FK → equipment_models.id |
| compatibility_notes | TEXT      | Nullable                     |

### H. Admin management

#### 27. `admin_profiles`

| Attribute  | Data Type    | Constraint                   |
| ---------- | ------------ | ---------------------------- |
| id         | UUID         | PK, FK → auth.users.id       |
| full_name  | VARCHAR(150) | NN                           |
| role       | VARCHAR(20)  | super_admin / admin / editor |
| is_active  | BOOLEAN      | Default true                 |
| created_at | TIMESTAMPTZ  | Default now()                |
| updated_at | TIMESTAMPTZ  | Default now()                |

#### 28. `audit_logs`

| Attribute   | Data Type    | Constraint               |
| ----------- | ------------ | ------------------------ |
| id          | UUID         | PK                       |
| admin_id    | UUID         | FK → admin_profiles.id   |
| entity_name | VARCHAR(100) | NN                       |
| entity_id   | UUID         | NN                       |
| action      | VARCHAR(20)  | insert / update / delete |
| old_data    | JSONB        | Nullable                 |
| new_data    | JSONB        | Nullable                 |
| created_at  | TIMESTAMPTZ  | Default now()            |

## 2. Entity relationship diagram

Core database relationships

Primary product, variant, price, specification, media, and category relationships. Other entities connect through their foreign keys as defined above.

## 3. Product classification structure

Example category hierarchy

Fabrics & Textiles

Knitted Fabrics · Woven Fabrics · Denim Fabrics · Printed Fabrics

Garments & CAD/CAM Accessories

Marker Paper · Pattern Paper · Plotter Ink · Cutting Poly · Cutter Blades

Industrial Machinery

Plotter Machines · Pattern Cutters · Sewing Machines · Dyeing & Finishing Machines

Dyes, Chemicals & Inks

Reactive Dyes · Textile Auxiliaries · Printing Inks · Finishing Chemicals

Packaging & Accessories

Paper Tubes · Labels · Poly Bags · Cartons

Industrial Safety Products

PPE · Fire Safety · Safety Signs

Software & Digital Solutions

CAD Software · Pattern-Making Software · Industrial ERP

## 4. Category-specific product attributes

All these attributes are configured through `attribute_definitions` and `category_attributes` rather than separate product tables.

| Product category       | Attributes                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Fabrics                | GSM, Width, Fiber Composition, Fabric Construction, Knit/Weave Type, Color, Finish, Stretch, Shrinkage |
| Marker / Pattern Paper | GSM, Width, Length, Grade, Color, Roll Weight, Paper Type                                              |
| Cutting Poly           | Material, Thickness, Width, Length, Density, Color                                                     |
| Textile Chemicals      | Chemical Type, Concentration, pH, Application, Form, Packaging Size                                    |
| Machinery              | Model, Working Width, Operating Speed, Power, Voltage, Capacity, Weight                                |
| Cutter Blades          | Blade Material, Length, Width, Thickness, Compatible Machine                                           |
| Inks                   | Ink Type, Color, Capacity, Compatible Printer, Cartridge Model                                         |
| Safety Products        | Safety Standard, Material, Size, Capacity, Certification                                               |
| CAD Software           | Version, License Type, Supported OS, Features, Minimum Requirements                                    |

## 5. Example database record

## White Marker Paper

Garments Accessories

Published

Product variants

| SKU    | GSM | Width | Price/kg |
| ------ | --- | ----- | -------- |
| MP-001 | 65  | 64 in | ৳85      |
| MP-002 | 70  | 64 in | ৳90      |
| MP-003 | 70  | 72 in | ৳95      |
| MP-004 | 80  | 90 in | ৳105     |

Illustrative sample data only, not actual market quotations.

1 product record → 4 variant records → corresponding specification and price records.

## 6. Database integrity, security and indexing

| Area                 | Required design                                                          |
| -------------------- | ------------------------------------------------------------------------ |
| Primary keys         | UUID for all main entities                                               |
| Foreign keys         | Enforced PostgreSQL FK constraints                                       |
| Categories           | Recursive parent-child category relationship                             |
| Variants             | Unique SKU and one default variant per product                           |
| Pricing              | Numeric precision, valid date ranges, non-overlapping active price tiers |
| Attributes           | Typed values, validated attribute options, unique scalar values          |
| Publishing           | Draft and archived products excluded from public reads                   |
| Deletion             | Prefer soft delete for products                                          |
| Media                | Supabase Storage with referenced file paths                              |
| Admin authentication | Supabase Auth with role-based permissions                                |
| Public frontend      | Read-only published catalog data                                         |
| Row Level Security   | Public SELECT on published data, admin-only writes                       |
| Auditing             | Record product and pricing modifications                                 |
| Performance          | B-tree indexes for SKU, slug, category, brand, variant and price FKs     |
| Search               | PostgreSQL full-text search with GIN indexes                             |
| Filtering            | Composite indexes on filterable attribute IDs and typed values           |
| Timestamps           | Automatic `updated_at` triggers                                          |

## 7. Supabase frontend access

Admin frontend

Authentication required

SELECT

INSERT

UPDATE

DELETE

Customer frontend

Public catalog

SELECT only

Published records only

Supabase API + PostgreSQL RLS

Supabase PostgreSQL

28 database entities · Product catalog · Pricing · Specifications · Media

Final design: 28 entities, with `products`, `product_variants`, `attribute_definitions`, `variant_attribute_values`, and `variant_prices` forming the central catalog architecture. No customer accounts, orders, carts, or transactional inventory tables are required for the specified read-only customer frontend.