alter table public.tappy_pages add column if not exists accent_color text;
alter table public.tappy_pages drop constraint if exists tappy_pages_accent_color_check;
alter table public.tappy_pages add constraint tappy_pages_accent_color_check check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$');
