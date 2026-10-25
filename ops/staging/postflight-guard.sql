-- Schema/privilege verification only: no fixtures, account creation or storage writes.
do $ann_postflight$
declare signature text;
begin
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')<>28
    or (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity)<>28 then
   raise exception 'Expected 28 core tables with RLS';
 end if;
 foreach signature in array array[
   'public.r2_create_upload(uuid,uuid,bigint,uuid,text,bigint,text,text,text,uuid)',
   'public.r2_claim_upload(uuid,uuid,bigint,uuid)',
   'public.r2_plan_promotion(uuid,uuid,uuid,jsonb,text,integer,integer)',
   'public.r2_finish_upload(uuid,uuid,bigint,uuid,uuid)',
   'public.r2_fail_upload(uuid,uuid,uuid)',
   'public.r2_prepare_cleanup(uuid)'
 ] loop
   if not has_function_privilege('service_role',signature,'EXECUTE')
      or has_function_privilege('authenticated',signature,'EXECUTE')
      or has_function_privilege('anon',signature,'EXECUTE') then
     raise exception 'Incorrect R2 RPC privilege: %',signature;
   end if;
 end loop;
 if has_function_privilege('service_role','public.attach_verified_image(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.stage_image(uuid,uuid,bigint,text,text,bigint)','EXECUTE') then
   raise exception 'Legacy image upload capability is still enabled';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public_catalog' and table_name='products' and column_name='image_key')
    or not has_table_privilege('anon','public_catalog.products','SELECT')
    or has_table_privilege('anon','public.products','SELECT') then
   raise exception 'Public catalog projection or access is incorrect';
 end if;
 if not exists(select 1 from storage.buckets where id='catalog-documents' and public=false and file_size_limit=10485760 and allowed_mime_types=array['application/pdf']) then
   raise exception 'Private PDF bucket configuration is incorrect';
 end if;
end $ann_postflight$;
