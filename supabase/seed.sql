-- Dictionary fixtures only. No live prices, credentials, admin users or competitor assets.
insert into public.units(name,code,symbol,unit_family,factor_to_base) values
('Kilogram','KG','kg','mass',1),('Gram','G','g','mass',0.001),('Meter','M','m','length',1),('Yard','YD','yd','length',0.9144),('Piece','PCS','pc','count',1),('Roll','ROLL','roll','count',null),('Liter','L','L','volume',1),('Gram per square meter','GSM','g/m²','areal_density',null);
insert into public.categories(name,slug,requires_composition) values
('Fabrics & Textiles','fabrics-textiles',true),('Garments & CAD/CAM Accessories','garments-cad-cam',false),('Industrial Machinery','industrial-machinery',false),('Dyes, Chemicals & Inks','dyes-chemicals-inks',false),('Packaging & Accessories','packaging-accessories',false),('Industrial Safety Products','industrial-safety',false),('Software & Digital Solutions','software-digital',false);
insert into public.fibers(name,code) values('Cotton','CO'),('Polyester','PES'),('Viscose','CV'),('Elastane','EL');
