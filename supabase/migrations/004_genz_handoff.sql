-- Raka writes for Gen Z; Dita automatically designs Raka's drafts in her default two-colour palette.

update agents
set settings = settings || '{"focus":"genz"}'::jsonb,
    responsibilities = '{"Memantau berita & tren yang ramai di kalangan Gen Z: viral, K-culture, film, game, teknologi, kampus & kerja",
      "Memverifikasi setiap berita minimal ke 2 outlet (politik 3 outlet)",
      "Menulis draft carousel & caption berbahasa Inggris dengan gaya Gen Z yang tetap akurat",
      "Menyerahkan draft ke Dita untuk didesain, lalu mengajukannya ke admin",
      "Mengirim laporan harian berita terbaru setiap pukul 07.00 WIB"}'
where slug = 'raka';

update agents
set settings = settings || '{"palette":{"bg":"#F4F1EA","fg":"#111111"},"format":"post"}'::jsonb,
    responsibilities = '{"Otomatis mendesain setiap draft Raka dengan palet 2 warna default",
      "Mengubah teks dari admin di Studio desain menjadi carousel, post kotak, atau story",
      "Menyorot kata penting yang ditandai *bintang* dengan blok warna terbalik",
      "Menyiapkan file siap unduh untuk diposting manual"}'
where slug = 'dita';
