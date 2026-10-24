-- Design-only bot employees: they don't hunt news, they turn text the admin supplies
-- into two-colour carousel/story designs.

alter table agents add column if not exists kind text not null default 'writer'; -- writer | designer

insert into agents (slug, name, role, color, kind, platforms, categories, responsibilities, settings)
values (
  'dita',
  'Dita',
  'Desainer Konten',
  '#E467B4',
  'designer',
  '{instagram:carousel,threads:carousel}',
  '{}',
  '{"Mengubah teks dari admin menjadi desain carousel, post kotak, dan story",
    "Hanya memakai 2 warna per desain sesuai palet yang dipilih admin",
    "Menyorot kata penting yang ditandai *bintang* dengan blok warna terbalik",
    "Mengirim hasil desain ke Inbox untuk disetujui sebelum terbit"}',
  '{"minSources":2,"minSourcesPolitics":3,"maxDraftsPerDay":30,"reportHour":7}'
)
on conflict (slug) do nothing;
