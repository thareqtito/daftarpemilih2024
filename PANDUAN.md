# Panduan Pasang: Arsip Model A Daftar Pemilih 2024

Aplikasi ini membaca PDF Model A yang sudah ada di dua folder Google Drive (Pemilu 2024 & Pilkada 2024). Tidak ada data yang disalin. Kalau isi folder berubah, cukup klik **Muat ulang data**.

## 1. Pasang Apps Script (sekali saja)
1. Login ke akun Google yang **punya / bisa membuka** kedua folder (mis. akun KPU Kab. Pacitan).
2. Buka https://script.google.com, lalu klik **Proyek baru**. Beri nama `Arsip Model A 2024`.
3. Hapus isi `Code.gs`, lalu tempel isi file **Code.gs** dari paket ini. Simpan.
4. Pilih fungsi **`setupAwal`**, klik **Jalankan**, lalu beri izin (Tinjau izin > pilih akun > Lanjutan > Buka). Fungsi ini membaca semua folder dan membuat indeks awal. Untuk ribuan file, prosesnya bisa memakan waktu 1–3 menit.
5. **Terapkan > Deployment baru > Aplikasi web**
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
6. Salin **URL aplikasi web** (berakhiran `/exec`).
7. (Opsional) Jalankan `pasangPemicuHarian` agar indeks diperbarui otomatis setiap hari pukul 02.00.

## 2. Pasang halaman web (GitHub Pages): dua alamat terpisah
Susunan file di repo GitHub:
```
logo-kpu.png          (opsional)
pemilu/index.html     → https://<akun>.github.io/<repo>/pemilu/
pilkada/index.html    → https://<akun>.github.io/<repo>/pilkada/
```
1. Di **kedua** file `index.html`, isi baris berikut dengan URL dari langkah 1.6 (URL-nya sama untuk keduanya):
   ```js
   const API_URL = 'https://script.google.com/macros/s/XXXX/exec';
   ```
2. Upload kedua folder (dan `logo-kpu.png` di root repo jika ada), lalu aktifkan Pages.
3. Selesai. Bagikan alamat `/pemilu/` atau `/pilkada/` sesuai kebutuhan. Masing-masing hanya menampilkan datanya sendiri.

> Bisa juga dipasang di dua repo berbeda. Cukup upload `index.html` masing-masing (logo diletakkan di samping file).
> URL Apps Script juga bisa ditempel lewat tombol **Pengaturan** di aplikasi. Isian ini tersimpan hanya di laptop tersebut.

## Fitur
- Dua aplikasi terpisah: **Pemilu 2024** dan **Pilkada 2024**
- Pilih **Kecamatan → Desa/Kelurahan**, atau klik kartu folder. Ada breadcrumb untuk kembali.
- **Cari** file/TPS lintas folder. Bisa beberapa kata, mis. `sidoharjo 005`.
- **Lihat** PDF langsung di aplikasi, **Unduh** per file, **Buka di Drive**.
- **Unduh semua (ZIP)** per desa atau kecamatan (maks. 25 MB per ZIP). Folder yang lebih besar diunduh per desa.
- Daftar file disimpan sementara di browser, jadi pembukaan berikutnya lebih cepat.

## Catatan
- Kedua folder harus berbagi **"Siapa saja yang memiliki link – Pelihat"** supaya tombol Lihat/Unduh berjalan di laptop mana pun tanpa login.
- Setelah menambah atau mengganti PDF di Drive, klik **Muat ulang data**.
- Script membuat 2 file kecil `_cache_model_a_2024_*.json` di Drive akun pemasang sebagai cache indeks. Jangan dihapus. Kalau terhapus, file itu dibuat ulang otomatis.
