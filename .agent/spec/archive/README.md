# Spec arsip

Spec yang sudah **digantikan**, disimpan sebagai jejak keputusan — bukan rencana yang berlaku.
Jangan dipakai sebagai acuan koding.

| Spec | Digantikan oleh | Sebab |
|---|---|---|
| `transkrip-tool` | `webapp-transkrip-mvp` | Pivot #1: desktop PySide6 → Chrome extension |
| `chrome-extension` | `webapp-transkrip-mvp` | Pivot #2 ([ADR 0002](../../../docs/adr/0002-pivot-webapp-upload-transkrip.md)): transkripsi pindah dari client ke server, upload-based |
| `backend-summarize` | menyusul saat M2 dikerjakan | Ditulis sebelum pivot; seam AI-nya kini `analysis/` ([ADR 0007](../../../docs/adr/0007-mesin-ai-dipilih-dari-ui.md)) |
| `mobile-flutter` | — | Klien mobile di luar arah sekarang; bisa dihidupkan lagi bila dibutuhkan |

Catatan: ide capture tab dari `chrome-extension` **relevan lagi** untuk fitur real-time ala Colibri
(lihat [colibri-direction.md](../../../docs/planning/colibri-direction.md) §rencana) — kerja lamanya
tidak sia-sia, hanya belum waktunya.
