alter table public.tappy_pages add column if not exists template text not null default 'classic';
alter table public.tappy_pages drop constraint if exists tappy_pages_template_check;
alter table public.tappy_pages add constraint tappy_pages_template_check check (template in ('classic', 'split', 'compact'));
