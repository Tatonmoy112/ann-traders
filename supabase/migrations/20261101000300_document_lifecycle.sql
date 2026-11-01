-- Retire documents without destroying source files or certification history.
begin;
alter table public.product_documents add column retired_at timestamptz;

create function public.product_document_action(product uuid,expected_revision bigint,document uuid,
  operation text,title_text text default null,visible boolean default null,variant uuid default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare d public.product_documents; result bigint;
begin
  perform private.require_role(array['super_admin','admin','editor']);
  perform private.integration_actor(auth.uid(),product,expected_revision);
  select * into d from public.product_documents where id=document and product_id=product and retired_at is null for update;
  if d.id is null then raise exception 'Document not found'; end if;
  if operation='retire' then
    if exists(select 1 from public.product_certifications where document_id=document) then
      raise exception 'Unlink this document from certifications before retiring it';
    end if;
    update public.product_documents set retired_at=now(),is_public=false where id=document;
  elsif operation='metadata' then
    if title_text is null or length(btrim(title_text)) not between 1 and 255 or visible is null then
      raise exception 'Document title and visibility are required';
    end if;
    if variant is not null and not exists(select 1 from public.product_variants where id=variant and product_id=product) then
      raise exception 'Foreign document variant';
    end if;
    update public.product_documents set title=btrim(title_text),is_public=visible,variant_id=variant where id=document;
  else raise exception 'Unknown document operation'; end if;
  update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
  return result;
end $$;
revoke execute on function public.product_document_action(uuid,bigint,uuid,text,text,boolean,uuid) from public,anon;
grant execute on function public.product_document_action(uuid,bigint,uuid,text,text,boolean,uuid) to authenticated;

create or replace view public_catalog.documents with (security_barrier=true) as
select d.id,d.product_id,d.variant_id,d.title,d.document_type,
  d.file_extension,d.bytes,p.name as product_name,p.product_code,p.slug as product_slug,d.created_at
from public.product_documents d join public_catalog.visibility visible on visible.id=d.product_id
join public.products p on p.id=d.product_id
where d.is_public and d.retired_at is null and (d.variant_id is null or exists(
  select 1 from public.product_variants v where v.id=d.variant_id and v.is_active));
notify pgrst,'reload schema';
commit;
