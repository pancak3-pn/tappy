alter table public.tappy_pages
  add column if not exists background_texture text not null default 'clean';

alter table public.tappy_pages
  drop constraint if exists tappy_pages_background_texture_check;

alter table public.tappy_pages
  add constraint tappy_pages_background_texture_check
  check (background_texture in ('clean', 'linen', 'silver', 'forest-grain', 'blueprint'));
