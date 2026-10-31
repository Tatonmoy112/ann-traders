-- Read-only preflight. Run in the intended Supabase project's SQL Editor.
-- One result table: Supabase's SQL Editor normally displays only the final
-- statement's results. False means the object does not exist in the database.
select name as required_object, to_regclass(name) is not null as exists_in_database
from (values
  ('public_catalog.products'),
  ('public_catalog.variants'),
  ('public_catalog.documents'),
  ('public.inquiries'),
  ('public_catalog.categories'),
  ('public_catalog.brands'),
  ('public_catalog.visibility'),
  ('public_catalog.product_cards'),
  ('public_catalog.product_details'),
  ('public_catalog.product_index')
) objects(name)
union all
select 'public_catalog.list_product_cards',
  to_regprocedure('public_catalog.list_product_cards(text,text,text,boolean,boolean,integer,integer,text,boolean)') is not null;

-- If the objects all exist but API reads still fail, verify the public role's
-- grants and reload PostgREST's schema cache; do not rerun CREATE VIEW blindly.
