alter table public.tappy_pages drop constraint if exists tappy_pages_background_texture_check;
alter table public.tappy_pages add constraint tappy_pages_background_texture_check check (background_texture in ('clean', 'linen', 'silver', 'forest-grain', 'blueprint', 'minimal-gradient', 'geometric-flow', 'soft-waves', 'tech-circuit', 'dark-texture'));
