# Protokol Debug Error dengan Cepat

> Sumber: template Bos (disimpan sesuai permintaan, 1 Nov 2026).
> Cara pakai: saat ada bug, kirim prompt di bawah ini ke assistant —
> isi bagian `[...]` atau tempel screenshot error-nya.

---

## Prompt Template

```text
Saya ada bug. JANGAN tulis fix dulu.

Error / perilaku yang tidak diharapkan: [TEMPEL ERROR]
Yang saya harapkan: [JELASKAN]
Yang sebenarnya terjadi: [JELASKAN]
Kode relevan: [TEMPEL ATAU TUNJUK FILE]
Yang sudah saya coba: [DAFTAR]

Langkah 1: Restate masalahnya pakai kata-katamu sendiri supaya kita satu pemahaman.
Langkah 2: Daftar 3-5 kemungkinan root cause paling besar, urut berdasarkan
probabilitas, tiap poin sertakan alasan.
Langkah 3: Untuk tiap penyebab, kasih satu cara tercepat untuk konfirmasi atau
eliminasi — satu log line, satu pengecekan, satu test singkat.
Langkah 4: Berhenti dan tunggu hasil dari saya.
Langkah 5: Setelah penyebabnya terkonfirmasi, baru tulis fix paling minimal,
jelaskan kenapa itu berhasil, dan beri tahu persis apa yang harus saya tes
untuk verifikasi.

Jangan shotgun perubahan. Jangan refactor kode yang tidak terkait.
Jangan benerin hal yang tidak saya minta.
```

---

## Ringkasan Aturan (untuk assistant)

1. **Diagnosa dulu, fix kemudian** — jangan pernah menulis perbaikan sebelum
   root cause terkonfirmasi.
2. **Restate masalah** dengan kata sendiri sebelum menganalisis.
3. **3–5 hipotesis root cause** diurutkan dari probabilitas terbesar, lengkap
   dengan alasan.
4. **Satu cara konfirmasi/eliminasi per hipotesis** — semurah mungkin
   (satu log, satu cek, satu test kecil).
5. **Berhenti & tunggu** hasil investigasi dari Bos sebelum lanjut.
6. **Fix paling minimal** setelah penyebab pasti — jelaskan mengapa berhasil
   + cara verifikasinya.
7. **Larangan:** no shotgun changes, no refactor tak terkait, no perbaikan
   yang tidak diminta.
