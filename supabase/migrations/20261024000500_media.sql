begin;
create function private.integration_actor(actor uuid,product uuid,expected_revision bigint) returns void language plpgsql set search_path='' as $$
declare p public.products;
begin
 if not exists(select 1 from public.admin_profiles where id=actor and is_active and role in ('super_admin','admin','editor')) then raise exception 'Inactive actor' using errcode='42501';end if;
 select * into p from public.products where id=product for update;
 if p.id is null or p.status<>'draft' or p.deleted_at is not null then raise exception 'An undeleted draft is required';end if;
 if p.revision<>expected_revision then raise exception 'Product changed; reload' using errcode='40001';end if;
end $$;
create function public.stage_image(actor uuid,product uuid,expected_revision bigint,asset text,mime text,size_bytes bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.integration_actor(actor,product,expected_revision);
 if mime not in ('image/jpeg','image/png','image/webp') or size_bytes<1 or size_bytes>10485760 then raise exception 'Invalid image metadata';end if;
 if (select count(*) from public.product_media where uploaded_by=actor and created_at>now()-interval '1 hour')>=50 then raise exception 'Hourly upload quota reached';end if;
 insert into public.product_media(product_id,media_type,provider_asset_id,uploaded_by,content_type,bytes) values(product,'image',asset,actor,mime,size_bytes) returning id into result;
 return result;
end $$;
create function public.attach_verified_image(actor uuid,product uuid,expected_revision bigint,media uuid,delivery text) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 perform private.integration_actor(actor,product,expected_revision);
 if not exists(select 1 from public.product_media where id=media and product_id=product and uploaded_by=actor and upload_status='pending') then raise exception 'Upload ownership mismatch';end if;
 update public.product_media set upload_status='ready',delivery_url=delivery,external_url=delivery,is_primary=not exists(select 1 from public.product_media where product_id=product and is_primary) where id=media;
 update public.products set revision=revision+1,updated_by=actor where id=product returning revision into result;
 return result;
end $$;
create function public.attach_verified_document(actor uuid,product uuid,expected_revision bigint,path text,title_text text,kind text,size_bytes bigint,visible boolean) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 perform private.integration_actor(actor,product,expected_revision);
 if path not like product::text||'/%' or path like '%..%' then raise exception 'Invalid document path';end if;
 insert into public.product_documents(product_id,title,document_type,storage_path,file_extension,is_public,uploaded_by,bytes) values(product,title_text,kind,path,'pdf',visible,actor,size_bytes);
 update public.products set revision=revision+1,updated_by=actor where id=product returning revision into result;
 return result;
end $$;
create function private.media_action(product uuid,expected_revision bigint,media uuid,operation text,alt text) returns bigint language plpgsql security definer set search_path='' as $$
declare m public.product_media;result bigint;
begin
 perform private.require_role(array['super_admin','admin','editor']);perform private.integration_actor(auth.uid(),product,expected_revision);
 select * into m from public.product_media where id=media and product_id=product for update;if m.id is null then raise exception 'Image not found';end if;
 if operation='primary' and m.upload_status='ready' then update public.product_media set is_primary=false where product_id=product;update public.product_media set is_primary=true where id=media;
 elsif operation='alt' then update public.product_media set alt_text=left(alt,255) where id=media;
 elsif operation='detach' then delete from public.product_media where id=media;
 else raise exception 'Invalid media action';end if;
 update public.products set revision=revision+1,updated_by=auth.uid() where id=product returning revision into result;
 if operation='detach' then insert into private.outbox_events(entity_id,event_type,revision,payload) values(product,'image.detach',result,jsonb_build_object('asset_id',m.provider_asset_id));end if;
 return result;
end $$;
create function public.product_media_action(product uuid,expected_revision bigint,media uuid,operation text,alt text default '') returns bigint language sql security invoker set search_path='' as $$select private.media_action(product,expected_revision,media,operation,alt)$$;
revoke execute on function private.integration_actor(uuid,uuid,bigint),private.media_action(uuid,bigint,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.stage_image(uuid,uuid,bigint,text,text,bigint),public.attach_verified_image(uuid,uuid,bigint,uuid,text),public.attach_verified_document(uuid,uuid,bigint,text,text,text,bigint,boolean),public.product_media_action(uuid,bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function public.stage_image(uuid,uuid,bigint,text,text,bigint),public.attach_verified_image(uuid,uuid,bigint,uuid,text),public.attach_verified_document(uuid,uuid,bigint,text,text,text,bigint,boolean) to service_role;
grant execute on function private.media_action(uuid,bigint,uuid,text,text),public.product_media_action(uuid,bigint,uuid,text,text) to authenticated;
commit;
