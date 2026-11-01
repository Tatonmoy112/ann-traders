begin;
create or replace function private.media_action(product uuid,expected_revision bigint,media uuid,operation text,alt text) returns bigint
language plpgsql security definer set search_path='' as $$
declare m public.product_media; result bigint; target_variant uuid;
begin
  perform private.require_role(array['super_admin','admin','editor']);
  perform private.integration_actor(auth.uid(),product,expected_revision);
  select * into m from public.product_media where id=media and product_id=product and retired_at is null for update;
  if m.id is null then raise exception 'Image not found'; end if;
  if operation='primary' and m.upload_status='ready' then
    update public.product_media set is_primary=false where product_id=product;
    update public.product_media set is_primary=true where id=media;
  elsif operation='alt' then update public.product_media set alt_text=left(alt,255) where id=media;
  elsif operation='detach' then
    update public.product_media set upload_status='retired',retired_at=now(),is_primary=false,verification_token=null,verification_lease_until=null where id=media;
  elsif operation='order' and alt ~ '^[0-9]{1,6}$' then update public.product_media set sort_order=alt::integer where id=media;
  elsif operation='variant' and m.upload_status='ready' then
    target_variant=nullif(alt,'')::uuid;
    if target_variant is not null and not exists(select 1 from public.product_variants where id=target_variant and product_id=product)
    then raise exception 'Foreign image variant'; end if;
    update public.product_media set variant_id=target_variant where id=media;
  else raise exception 'Invalid media action'; end if;
  update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
  if operation='detach' then insert into private.outbox_events(entity_id,event_type,revision,payload,available_at)
    values(media,'image.retired',result,jsonb_build_object('media_id',media,'provider',m.provider,'asset_id',m.provider_asset_id),
      greatest(now(),coalesce(m.upload_expires_at+interval '10 minutes',now()))); end if;
  return result;
end $$;

create function private.specification_dictionary_guard() returns trigger language plpgsql set search_path='' as $$
declare definition uuid;
begin
  if tg_table_name='attribute_definitions' then
    definition=new.id;
  else
    definition=new.attribute_id;
    perform 1 from public.attribute_definitions where id=definition for update;
    if (new.attribute_id,new.value) is distinct from (old.attribute_id,old.value) and (
      exists(select 1 from public.product_attribute_values where option_id=old.id) or
      exists(select 1 from public.variant_attribute_values where option_id=old.id)) then
      raise exception 'Referenced option identity is immutable; create another option';
    end if;
  end if;
  if old.is_active and not new.is_active and (
    exists(select 1 from public.product_attribute_values av join public.products p on p.id=av.product_id
      where av.attribute_id=definition and (tg_table_name='attribute_definitions' or av.option_id=new.id)
        and p.status='published' and p.deleted_at is null) or
    exists(select 1 from public.variant_attribute_values av join public.product_variants v on v.id=av.variant_id
      join public.products p on p.id=v.product_id where av.attribute_id=definition
        and (tg_table_name='attribute_definitions' or av.option_id=new.id) and v.is_active
        and p.status='published' and p.deleted_at is null))
  then raise exception 'Unpublish affected products before disabling their specifications'; end if;
  return new;
end $$;
create trigger specification_dictionary_guard before update on public.attribute_definitions
  for each row execute function private.specification_dictionary_guard();
create trigger specification_option_guard before update on public.attribute_options
  for each row execute function private.specification_dictionary_guard();
revoke execute on function private.specification_dictionary_guard() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
