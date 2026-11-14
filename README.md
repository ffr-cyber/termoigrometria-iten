# Analisi termoigrometrica di una parete

Sito statico per il lavoro a gruppi della 4ª ITT Energia: dati di progetto, verifica dei calcoli Excel, scelta dell'isolamento con preventivo, export dei dati, verifica di condensa con il metodo di Glaser, termografia simulata della sezione e relazione finale (PDF ed Excel).

- Nessun server: tutti i calcoli avvengono nel browser; il sito contiene solo il database dei materiali (`data.js`).
- Il lavoro si salva nel browser e con il pulsante **Salva progresso** (.json); **Carica progresso** lo riprende su un altro PC. **Nuovo progetto** svuota il browser (da usare sui PC condivisi).
- I codici di sblocco della sezione 2 non sono nel sorgente: c'è solo la loro impronta SHA-256.

## Fonti dei dati
- λ, π, Rsi, Rse: manuale in uso in classe (Tab. 4.7, 4.13, 4.14, 5.2).
- Prezzi: Prezzario Regione Friuli Venezia Giulia 2025 (voci 46.2.KN7.10, 46.2.KN7.05, 46.2.KM1.04, 46.2.KM1.01, 22.3.RR2.04, 99.3.AH2.15); freno al vapore: stima didattica.
- Trasmittanza limite: DM 26/06/2015 e DM 28/10/2025, Appendice B Tab. 1; +30 % con isolamento interno (All. 1 § 1.4.3).
- Umidità e conducibilità: fψ da EN ISO 10456 (valori riportati da ANIT).

## Pubblicazione
Settings → Pages → Deploy from a branch → `main` / root.

Libreria inclusa: SheetJS Community Edition 0.18.5 (`vendor/`, licenza Apache 2.0).
