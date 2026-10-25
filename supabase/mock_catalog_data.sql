-- ==============================================================================
-- ANN TRADERS: COMPREHENSIVE MOCK CATALOG SEED DATA
-- Safe, idempotent seed data to explore and test the entire Admin Panel.
-- ==============================================================================

DO $$
DECLARE
  v_admin_id uuid;
  v_unit_kg uuid;
  v_unit_m uuid;
  v_unit_yd uuid;
  v_unit_pc uuid;
  v_unit_roll uuid;
  v_unit_drum uuid;
  v_unit_gsm uuid;
  
  v_cat_fabrics uuid;
  v_cat_cad uuid;
  v_cat_machinery uuid;
  v_cat_dyes uuid;
  v_cat_packaging uuid;
  v_cat_safety uuid;

  v_brand_ann uuid;
  v_brand_albatross uuid;
  v_brand_dystar uuid;
  v_brand_eastman uuid;
  v_brand_packwell uuid;
  v_brand_3m uuid;

  v_prod_1 uuid;
  v_prod_2 uuid;
  v_prod_3 uuid;
  v_prod_4 uuid;
  v_prod_5 uuid;
  v_prod_6 uuid;

  v_var_1a uuid;
  v_var_1b uuid;
  v_var_2a uuid;
  v_var_2b uuid;
  v_var_3a uuid;
  v_var_4a uuid;
  v_var_5a uuid;
  v_var_6a uuid;

  v_fiber_co uuid;
  v_fiber_pes uuid;
  v_fiber_el uuid;

  v_eq_eastman uuid;

  v_ind_rmg uuid;
  v_ind_textile uuid;
  v_ind_spinning uuid;

  v_app_cad uuid;
  v_app_cutting uuid;
  v_app_dyeing uuid;

  v_cert_oeko uuid;
  v_cert_iso uuid;

  v_price_1a uuid;
  v_price_1b uuid;
  v_price_2a uuid;
  v_price_3a uuid;
  v_price_4a uuid;
BEGIN
  -- 1. Identify active admin profile to attribute records to
  SELECT id INTO v_admin_id FROM public.admin_profiles WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No active admin profile found. Please create an admin profile first.';
  END IF;

  -- 2. Ensure Standard Units exist
  INSERT INTO public.units (name, code, symbol, unit_family, factor_to_base)
  VALUES 
    ('Kilogram', 'KG', 'kg', 'mass', 1),
    ('Gram', 'G', 'g', 'mass', 0.001),
    ('Meter', 'M', 'm', 'length', 1),
    ('Yard', 'YD', 'yd', 'length', 0.9144),
    ('Piece', 'PCS', 'pc', 'count', 1),
    ('Roll', 'ROLL', 'roll', 'count', NULL),
    ('Drum', 'DRUM', 'drum', 'count', NULL),
    ('Liter', 'L', 'L', 'volume', 1),
    ('Gram per square meter', 'GSM', 'g/m²', 'areal_density', NULL)
  ON CONFLICT (code) DO UPDATE SET is_active = true;

  SELECT id INTO v_unit_kg FROM public.units WHERE code = 'KG';
  SELECT id INTO v_unit_m FROM public.units WHERE code = 'M';
  SELECT id INTO v_unit_yd FROM public.units WHERE code = 'YD';
  SELECT id INTO v_unit_pc FROM public.units WHERE code = 'PCS';
  SELECT id INTO v_unit_roll FROM public.units WHERE code = 'ROLL';
  SELECT id INTO v_unit_drum FROM public.units WHERE code = 'DRUM';
  SELECT id INTO v_unit_gsm FROM public.units WHERE code = 'GSM';

  -- 3. Ensure Categories exist
  INSERT INTO public.categories (name, slug, description, requires_composition, sort_order)
  VALUES 
    ('Fabrics & Textiles', 'fabrics-textiles', 'Woven, knit, and blended textile fabrics and yarns', true, 1),
    ('Garments & CAD/CAM Accessories', 'garments-cad-cam', 'Marker paper, plotter inks, cutter blades, and underlay paper', false, 2),
    ('Industrial Machinery', 'industrial-machinery', 'Automated cutting systems, sewing machinery, and spreading tables', false, 3),
    ('Dyes, Chemicals & Inks', 'dyes-chemicals-inks', 'Textile dyes, washing auxiliaries, and digital printing inks', false, 4),
    ('Packaging & Accessories', 'packaging-accessories', 'Export cartons, polybags, hangtags, and packaging tape', false, 5),
    ('Industrial Safety Products', 'industrial-safety', 'PPE, gloves, safety boots, and factory workwear', false, 6),
    ('Software & Digital Solutions', 'software-digital', 'CAD/CAM pattern grading licenses and ERP systems', false, 7)
  ON CONFLICT (slug) DO UPDATE SET is_active = true;

  SELECT id INTO v_cat_fabrics FROM public.categories WHERE slug = 'fabrics-textiles';
  SELECT id INTO v_cat_cad FROM public.categories WHERE slug = 'garments-cad-cam';
  SELECT id INTO v_cat_machinery FROM public.categories WHERE slug = 'industrial-machinery';
  SELECT id INTO v_cat_dyes FROM public.categories WHERE slug = 'dyes-chemicals-inks';
  SELECT id INTO v_cat_packaging FROM public.categories WHERE slug = 'packaging-accessories';
  SELECT id INTO v_cat_safety FROM public.categories WHERE slug = 'industrial-safety';

  -- 4. Brands
  INSERT INTO public.brands (name, slug, description, website_url, country_code, is_active)
  VALUES
    ('ANN Prime', 'ann-prime', 'Premium in-house textiles and garments supplies', 'https://anntraders.com', 'BD', true),
    ('Albatross Paper', 'albatross-paper', 'High-tensile CAD marker and plotter rolls', 'https://albatrosspaper.com', 'US', true),
    ('DyStar Colors', 'dystar-colors', 'Global ecological textile dyes and auxiliaries', 'https://dystar.com', 'DE', true),
    ('Eastman Machinery', 'eastman-machinery', 'Heavy-duty industrial automated cutting machinery', 'https://eastmancuts.com', 'US', true),
    ('PackWell Industrial', 'packwell-industrial', 'Corrugated heavy packaging solutions for RMG export', 'https://packwellbd.com', 'BD', true),
    ('3M Safety', '3m-safety', 'Certified personal protective equipment and factory safety gear', 'https://3m.com', 'US', true)
  ON CONFLICT (slug) DO UPDATE SET is_active = true;

  SELECT id INTO v_brand_ann FROM public.brands WHERE slug = 'ann-prime';
  SELECT id INTO v_brand_albatross FROM public.brands WHERE slug = 'albatross-paper';
  SELECT id INTO v_brand_dystar FROM public.brands WHERE slug = 'dystar-colors';
  SELECT id INTO v_brand_eastman FROM public.brands WHERE slug = 'eastman-machinery';
  SELECT id INTO v_brand_packwell FROM public.brands WHERE slug = 'packwell-industrial';
  SELECT id INTO v_brand_3m FROM public.brands WHERE slug = '3m-safety';

  -- 5. Fibers
  INSERT INTO public.fibers (name, code)
  VALUES 
    ('Cotton', 'CO'),
    ('Polyester', 'PES'),
    ('Elastane / Spandex', 'EL'),
    ('Viscose', 'CV')
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_fiber_co FROM public.fibers WHERE code = 'CO';
  SELECT id INTO v_fiber_pes FROM public.fibers WHERE code = 'PES';
  SELECT id INTO v_fiber_el FROM public.fibers WHERE code = 'EL';

  -- 6. Equipment Models (model_name, brand_id, equipment_type, description)
  INSERT INTO public.equipment_models (brand_id, model_name, equipment_type, description)
  SELECT v_brand_eastman, 'Eagle C125', 'CNC Conveyor Cutter', 'High-ply automated fabric cutting conveyor system'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.equipment_models WHERE brand_id = v_brand_eastman AND LOWER(model_name) = 'eagle c125'
  );

  SELECT id INTO v_eq_eastman FROM public.equipment_models WHERE brand_id = v_brand_eastman AND LOWER(model_name) = 'eagle c125';

  -- 7. Industries & Applications
  INSERT INTO public.industries (name, slug, description)
  VALUES
    ('Ready-Made Garments (RMG)', 'ready-made-garments', 'Woven and knitwear export garment manufacturers'),
    ('Textile Dyeing & Finishing', 'textile-dyeing', 'Continuous and exhaust dyeing operations'),
    ('Spinning & Weaving', 'spinning-weaving', 'Yarn spinners and gray fabric weavers')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_ind_rmg FROM public.industries WHERE slug = 'ready-made-garments';
  SELECT id INTO v_ind_textile FROM public.industries WHERE slug = 'textile-dyeing';
  SELECT id INTO v_ind_spinning FROM public.industries WHERE slug = 'spinning-weaving';

  INSERT INTO public.applications (name, slug, description)
  VALUES
    ('CAD Marker Printing', 'cad-marker-printing', 'High-speed inkjet plotter pattern layout'),
    ('Fabric Automatic Cutting', 'fabric-automatic-cutting', 'High-ply CNC fabric cutting rooms'),
    ('Reactive Garment Dyeing', 'reactive-garment-dyeing', 'Direct dye exhaustion for cotton knitwear')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_app_cad FROM public.applications WHERE slug = 'cad-marker-printing';
  SELECT id INTO v_app_cutting FROM public.applications WHERE slug = 'fabric-automatic-cutting';
  SELECT id INTO v_app_dyeing FROM public.applications WHERE slug = 'reactive-garment-dyeing';

  -- 8. Certifications (name, issuing_organization, description)
  INSERT INTO public.certifications (name, issuing_organization, description)
  SELECT 'OEKO-TEX Standard 100', 'OEKO-TEX Association', 'Confidence in Textiles - Tested for harmful substances'
  WHERE NOT EXISTS (SELECT 1 FROM public.certifications WHERE LOWER(name) = LOWER('OEKO-TEX Standard 100'));

  INSERT INTO public.certifications (name, issuing_organization, description)
  SELECT 'ISO 9001:2015', 'International Organization for Standardization', 'Quality Management System Requirements'
  WHERE NOT EXISTS (SELECT 1 FROM public.certifications WHERE LOWER(name) = LOWER('ISO 9001:2015'));

  SELECT id INTO v_cert_oeko FROM public.certifications WHERE LOWER(name) = LOWER('OEKO-TEX Standard 100');
  SELECT id INTO v_cert_iso FROM public.certifications WHERE LOWER(name) = LOWER('ISO 9001:2015');

  -- ==============================================================================
  -- PRODUCTS CREATION
  -- ==============================================================================

  -- PRODUCT 1: CAD Marker Paper 70 GSM (PUBLISHED)
  INSERT INTO public.products (
    primary_category_id, brand_id, product_code, name, slug, product_type,
    short_description, description, country_of_origin, is_featured, is_new_arrival,
    status, published_at, created_by, updated_by, revision
  ) VALUES (
    v_cat_cad, v_brand_albatross, 'CAD-MP-70', 'Premium High-Tensile CAD Marker Paper 70 GSM',
    'premium-high-tensile-cad-marker-paper-70-gsm', 'physical',
    'Industrial high-speed plotter paper roll designed for crisp apparel marker lines without ink bleeding.',
    'Engineered specifically for RMG garment cutting rooms. Features balanced moisture resistance, smooth feed through high-speed plotters, and high tear-resistance under automatic cutting blade vibration.',
    'US', true, true, 'published', now(), v_admin_id, v_admin_id, 1
  )
  ON CONFLICT (product_code) DO UPDATE SET 
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description
  RETURNING id INTO v_prod_1;

  -- Variants for Product 1
  INSERT INTO public.product_variants (
    product_id, sku, variant_name, model_number, base_unit_id,
    minimum_order_qty, minimum_order_unit_id, monthly_supply_capacity, capacity_unit_id,
    lead_time_days, availability_status, is_default, is_active
  ) VALUES 
    (v_prod_1, 'CAD-MP-70-64', 'Width 64" (162 cm) Roll', 'ALB-70-64', v_unit_roll, 10, v_unit_roll, 5000, v_unit_roll, 2, 'in_stock', true, true),
    (v_prod_1, 'CAD-MP-70-72', 'Width 72" (183 cm) Roll', 'ALB-70-72', v_unit_roll, 10, v_unit_roll, 3500, v_unit_roll, 2, 'in_stock', false, true)
  ON CONFLICT (sku) DO UPDATE SET is_active = true;

  SELECT id INTO v_var_1a FROM public.product_variants WHERE sku = 'CAD-MP-70-64';
  SELECT id INTO v_var_1b FROM public.product_variants WHERE sku = 'CAD-MP-70-72';

  -- Pricing for Product 1
  INSERT INTO public.variant_prices (
    variant_id, currency_code, price_type, min_price, max_price, price_unit_id, trade_term, valid_from, is_active
  ) 
  SELECT v_var_1a, 'BDT', 'fixed', 2850.00, NULL, v_unit_roll, 'Ex-Factory Dhaka', now(), true
  WHERE NOT EXISTS (SELECT 1 FROM public.variant_prices WHERE variant_id = v_var_1a);

  INSERT INTO public.variant_prices (
    variant_id, currency_code, price_type, min_price, max_price, price_unit_id, trade_term, valid_from, is_active
  ) 
  SELECT v_var_1b, 'BDT', 'fixed', 3200.00, NULL, v_unit_roll, 'Ex-Factory Dhaka', now(), true
  WHERE NOT EXISTS (SELECT 1 FROM public.variant_prices WHERE variant_id = v_var_1b);

  SELECT id INTO v_price_1a FROM public.variant_prices WHERE variant_id = v_var_1a LIMIT 1;
  IF v_price_1a IS NOT NULL THEN
    INSERT INTO public.price_tiers (variant_price_id, min_quantity, max_quantity, quantity_unit_id, unit_price, sort_order)
    SELECT v_price_1a, 10, 49, v_unit_roll, 2850.00, 1
    WHERE NOT EXISTS (SELECT 1 FROM public.price_tiers WHERE variant_price_id = v_price_1a AND min_quantity = 10);

    INSERT INTO public.price_tiers (variant_price_id, min_quantity, max_quantity, quantity_unit_id, unit_price, sort_order)
    SELECT v_price_1a, 50, NULL, v_unit_roll, 2650.00, 2
    WHERE NOT EXISTS (SELECT 1 FROM public.price_tiers WHERE variant_price_id = v_price_1a AND min_quantity = 50);
  END IF;

  -- Packaging for Product 1
  INSERT INTO public.variant_packaging (variant_id, packaging_type, pack_quantity, pack_unit_id, package_description, is_default)
  SELECT v_var_1a, 'Heavy Kraft Tube', 1, v_unit_roll, 'Reinforced 165x15x15 cm cardboard core tube', true
  WHERE NOT EXISTS (SELECT 1 FROM public.variant_packaging WHERE variant_id = v_var_1a);

  -- Mock Primary Media for Product 1 (ensures publication checks pass)
  INSERT INTO public.product_media (
    product_id, media_type, provider, provider_asset_id, delivery_url,
    upload_status, is_primary, uploaded_by, content_type, bytes, width, height, alt_text
  ) 
  SELECT 
    v_prod_1, 'image', 'cloudflare_images', 'mock-asset-cad-70',
    'https://imagedelivery.net/synth-account/' || replace(v_prod_1::text, '-', '') || '/detail',
    'ready', true, v_admin_id, 'image/webp', 102400, 1024, 1024, 'CAD Marker Paper Roll Preview'
  WHERE NOT EXISTS (SELECT 1 FROM public.product_media WHERE product_id = v_prod_1 AND is_primary = true);

  -- Relations for Product 1
  INSERT INTO public.product_industries (product_id, industry_id) VALUES (v_prod_1, v_ind_rmg) ON CONFLICT DO NOTHING;
  INSERT INTO public.product_applications (product_id, application_id) VALUES (v_prod_1, v_app_cad) ON CONFLICT DO NOTHING;


  -- PRODUCT 2: Reactive Liquid Dye (PUBLISHED)
  INSERT INTO public.products (
    primary_category_id, brand_id, product_code, name, slug, product_type,
    short_description, description, country_of_origin, is_featured, is_new_arrival,
    status, published_at, created_by, updated_by, revision
  ) VALUES (
    v_cat_dyes, v_brand_dystar, 'DYE-RB-02', 'Levafix Royal Blue E-BA Liquid Dye',
    'levafix-royal-blue-e-ba-liquid-dye', 'physical',
    'High-exhaustion reactive blue dye with superior light and perspiration fastness for cotton knitwear.',
    'Suitable for exhaust dyeing of cellulosic fibers. Delivers brilliant deep shades with excellent wash durability. Complies with ZDHC Level 3 requirements.',
    'DE', true, false, 'published', now(), v_admin_id, v_admin_id, 1
  )
  ON CONFLICT (product_code) DO UPDATE SET 
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description
  RETURNING id INTO v_prod_2;

  INSERT INTO public.product_variants (
    product_id, sku, variant_name, model_number, base_unit_id,
    minimum_order_qty, minimum_order_unit_id, monthly_supply_capacity, capacity_unit_id,
    lead_time_days, availability_status, is_default, is_active
  ) VALUES 
    (v_prod_2, 'DYE-RB02-50KG', '50 KG Sealed Drum', 'LVF-RB-50', v_unit_kg, 100, v_unit_kg, 10000, v_unit_kg, 5, 'in_stock', true, true),
    (v_prod_2, 'DYE-RB02-200KG', '200 KG Industrial Barrel', 'LVF-RB-200', v_unit_kg, 200, v_unit_kg, 15000, v_unit_kg, 7, 'in_stock', false, true)
  ON CONFLICT (sku) DO UPDATE SET is_active = true;

  SELECT id INTO v_var_2a FROM public.product_variants WHERE sku = 'DYE-RB02-50KG';

  INSERT INTO public.variant_prices (
    variant_id, currency_code, price_type, min_price, max_price, price_unit_id, trade_term, valid_from, is_active
  ) 
  SELECT v_var_2a, 'BDT', 'range', 450.00, 485.00, v_unit_kg, 'Delivered Gazipur / Narayanganj', now(), true
  WHERE NOT EXISTS (SELECT 1 FROM public.variant_prices WHERE variant_id = v_var_2a);

  -- Mock Primary Media for Product 2
  INSERT INTO public.product_media (
    product_id, media_type, provider, provider_asset_id, delivery_url,
    upload_status, is_primary, uploaded_by, content_type, bytes, width, height, alt_text
  ) 
  SELECT 
    v_prod_2, 'image', 'cloudflare_images', 'mock-asset-dye-rb02',
    'https://imagedelivery.net/synth-account/' || replace(v_prod_2::text, '-', '') || '/detail',
    'ready', true, v_admin_id, 'image/webp', 95200, 1024, 1024, 'Levafix Royal Blue Container'
  WHERE NOT EXISTS (SELECT 1 FROM public.product_media WHERE product_id = v_prod_2 AND is_primary = true);

  INSERT INTO public.product_industries (product_id, industry_id) VALUES (v_prod_2, v_ind_textile) ON CONFLICT DO NOTHING;
  INSERT INTO public.product_applications (product_id, application_id) VALUES (v_prod_2, v_app_dyeing) ON CONFLICT DO NOTHING;
  
  INSERT INTO public.product_certifications (product_id, certification_id, certificate_number)
  SELECT v_prod_2, v_cert_oeko, 'OEKO-TEX-ZDHC-LV3'
  WHERE NOT EXISTS (SELECT 1 FROM public.product_certifications WHERE product_id = v_prod_2 AND certification_id = v_cert_oeko);


  -- PRODUCT 3: 100% Combed Compact Cotton Yarn (PUBLISHED)
  INSERT INTO public.products (
    primary_category_id, brand_id, product_code, name, slug, product_type,
    short_description, description, country_of_origin, is_featured, is_new_arrival,
    status, published_at, created_by, updated_by, revision
  ) VALUES (
    v_cat_fabrics, v_brand_ann, 'YRN-30-1-CC', '100% Combed Compact Cotton Knitting Yarn 30s/1',
    '100-combed-compact-cotton-knitting-yarn-30s-1', 'physical',
    'Ring-spun 30/1 compact yarn for single jersey and interlock circular knitting machines.',
    'Produced from contamination-free long-staple cotton fibers. Low hairiness, high tensile strength, and uniform count CV for export-quality T-shirts and polo shirts.',
    'BD', false, true, 'published', now(), v_admin_id, v_admin_id, 1
  )
  ON CONFLICT (product_code) DO UPDATE SET 
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description
  RETURNING id INTO v_prod_3;

  INSERT INTO public.product_variants (
    product_id, sku, variant_name, model_number, base_unit_id,
    minimum_order_qty, minimum_order_unit_id, monthly_supply_capacity, capacity_unit_id,
    lead_time_days, availability_status, is_default, is_active
  ) VALUES 
    (v_prod_3, 'YRN-30-1-RAW', 'Raw White Cone', 'ANN-30S-CC', v_unit_kg, 1000, v_unit_kg, 50000, v_unit_kg, 14, 'made_to_order', true, true)
  ON CONFLICT (sku) DO UPDATE SET is_active = true;

  SELECT id INTO v_var_3a FROM public.product_variants WHERE sku = 'YRN-30-1-RAW';

  -- Fiber composition required for fabrics/textiles category!
  INSERT INTO public.variant_fiber_composition (variant_id, fiber_id, percentage)
  VALUES (v_var_3a, v_fiber_co, 100.00)
  ON CONFLICT (variant_id, fiber_id) DO NOTHING;

  INSERT INTO public.variant_prices (
    variant_id, currency_code, price_type, min_price, max_price, price_unit_id, trade_term, valid_from, is_active
  ) 
  SELECT v_var_3a, 'USD', 'fixed', 3.95, NULL, v_unit_kg, 'FOB Chittagong', now(), true
  WHERE NOT EXISTS (SELECT 1 FROM public.variant_prices WHERE variant_id = v_var_3a);

  -- Mock Primary Media for Product 3
  INSERT INTO public.product_media (
    product_id, media_type, provider, provider_asset_id, delivery_url,
    upload_status, is_primary, uploaded_by, content_type, bytes, width, height, alt_text
  ) 
  SELECT 
    v_prod_3, 'image', 'cloudflare_images', 'mock-asset-yrn-30',
    'https://imagedelivery.net/synth-account/' || replace(v_prod_3::text, '-', '') || '/detail',
    'ready', true, v_admin_id, 'image/webp', 112000, 1024, 1024, 'Cotton Knitting Yarn Cone'
  WHERE NOT EXISTS (SELECT 1 FROM public.product_media WHERE product_id = v_prod_3 AND is_primary = true);

  INSERT INTO public.product_industries (product_id, industry_id) VALUES (v_prod_3, v_ind_spinning) ON CONFLICT DO NOTHING;


  -- PRODUCT 4: CNC Automated Fabric Cutter (DRAFT)
  INSERT INTO public.products (
    primary_category_id, brand_id, product_code, name, slug, product_type,
    short_description, description, country_of_origin, is_featured, is_new_arrival,
    status, published_at, created_by, updated_by, revision
  ) VALUES (
    v_cat_machinery, v_brand_eastman, 'MC-CNC-C125', 'Eastman Eagle C125 Multi-Ply Conveyor Cutting System',
    'eastman-eagle-c125-multi-ply-conveyor-cutting-system', 'physical',
    'High-capacity automated CNC reciprocating knife cutter for mass production garment plants.',
    'Cuts up to 7.5 cm compressed fabric plies. Featuring real-time knife deflection compensation, tool changer, and automated conveyor offload table.',
    'US', false, false, 'draft', NULL, v_admin_id, v_admin_id, 1
  )
  ON CONFLICT (product_code) DO UPDATE SET 
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description
  RETURNING id INTO v_prod_4;

  INSERT INTO public.product_variants (
    product_id, sku, variant_name, model_number, base_unit_id,
    minimum_order_qty, minimum_order_unit_id, monthly_supply_capacity, capacity_unit_id,
    lead_time_days, availability_status, is_default, is_active
  ) VALUES 
    (v_prod_4, 'MC-C125-STD', 'Standard 2.5m Width Cutting Gantry', 'C125-250', v_unit_pc, 1, v_unit_pc, 5, v_unit_pc, 45, 'on_request', true, true)
  ON CONFLICT (sku) DO UPDATE SET is_active = true;

  SELECT id INTO v_var_4a FROM public.product_variants WHERE sku = 'MC-C125-STD';

  INSERT INTO public.variant_prices (
    variant_id, currency_code, price_type, min_price, max_price, price_unit_id, trade_term, valid_from, is_active
  ) 
  SELECT v_var_4a, 'USD', 'on_request', NULL, NULL, v_unit_pc, 'CIF Dhaka Airport', now(), true
  WHERE NOT EXISTS (SELECT 1 FROM public.variant_prices WHERE variant_id = v_var_4a);

  IF v_eq_eastman IS NOT NULL THEN
    INSERT INTO public.variant_equipment_compatibility (variant_id, equipment_model_id, compatibility_notes)
    VALUES (v_var_4a, v_eq_eastman, 'Original manufacturer compatible cutting conveyor system')
    ON CONFLICT (variant_id, equipment_model_id) DO NOTHING;
  END IF;


  -- PRODUCT 5: Corrugated Garment Export Carton (DRAFT)
  INSERT INTO public.products (
    primary_category_id, brand_id, product_code, name, slug, product_type,
    short_description, description, country_of_origin, is_featured, is_new_arrival,
    status, published_at, created_by, updated_by, revision
  ) VALUES (
    v_cat_packaging, v_brand_packwell, 'PKG-CTN-5P', '5-Ply Heavy-Duty Corrugated Master Carton (60x40x35 cm)',
    '5-ply-heavy-duty-corrugated-master-carton', 'physical',
    'Reinforced corrugated carton box designed for sea and air freight garment shipments.',
    'Constructed from 150 GSM virgin Kraft linerboard. High edge crush test (ECT 44) rating ensuring stack stability in 40ft container shipments.',
    'BD', false, false, 'draft', NULL, v_admin_id, v_admin_id, 1
  )
  ON CONFLICT (product_code) DO UPDATE SET 
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description
  RETURNING id INTO v_prod_5;

  INSERT INTO public.product_variants (
    product_id, sku, variant_name, model_number, base_unit_id,
    minimum_order_qty, minimum_order_unit_id, monthly_supply_capacity, capacity_unit_id,
    lead_time_days, availability_status, is_default, is_active
  ) VALUES 
    (v_prod_5, 'PKG-CTN-6040', 'Standard 60x40x35 cm (5-Ply)', 'PW-5P-6040', v_unit_pc, 500, v_unit_pc, 100000, v_unit_pc, 3, 'in_stock', true, true)
  ON CONFLICT (sku) DO UPDATE SET is_active = true;

  SELECT id INTO v_var_5a FROM public.product_variants WHERE sku = 'PKG-CTN-6040';

  INSERT INTO public.variant_prices (
    variant_id, currency_code, price_type, min_price, max_price, price_unit_id, trade_term, valid_from, is_active
  ) 
  SELECT v_var_5a, 'BDT', 'fixed', 88.50, NULL, v_unit_pc, 'Ex-Factory Ashulia', now(), true
  WHERE NOT EXISTS (SELECT 1 FROM public.variant_prices WHERE variant_id = v_var_5a);


  -- PRODUCT 6: Heavy Industrial Safety Boots (ARCHIVED)
  INSERT INTO public.products (
    primary_category_id, brand_id, product_code, name, slug, product_type,
    short_description, description, country_of_origin, is_featured, is_new_arrival,
    status, published_at, created_by, updated_by, revision
  ) VALUES (
    v_cat_safety, v_brand_3m, 'SFT-BOT-01', '3M Steel Toe Anti-Puncture Industrial Work Boots',
    '3m-steel-toe-anti-puncture-industrial-work-boots', 'physical',
    'Oil and acid resistant steel toe safety footwear for factory dye-house and mechanical operators.',
    'EN ISO 20345:2011 S3 certified. Features shock-absorbing polyurethane sole, anti-slip tread, and breathable leather upper.',
    'US', false, false, 'archived', NULL, v_admin_id, v_admin_id, 1
  )
  ON CONFLICT (product_code) DO UPDATE SET 
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description
  RETURNING id INTO v_prod_6;

  INSERT INTO public.product_variants (
    product_id, sku, variant_name, model_number, base_unit_id,
    minimum_order_qty, minimum_order_unit_id, monthly_supply_capacity, capacity_unit_id,
    lead_time_days, availability_status, is_default, is_active
  ) VALUES 
    (v_prod_6, 'SFT-BOT-42', 'Size 42 EU / 8.5 US', '3M-BOT-42', v_unit_pc, 10, v_unit_pc, 1000, v_unit_pc, 7, 'out_of_stock', true, true)
  ON CONFLICT (sku) DO UPDATE SET is_active = true;

  RAISE NOTICE 'ANN Traders mock catalog seed completed successfully.';
END $$;
