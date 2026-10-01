# 11BG · Make a difference

Salbeigrüne Lernwebsite zur Englischklausur am **22.10.2026**: Gap Years, Point out, einfache Redeanalyse und eigenes Redenschreiben.

## Sofort nutzbar

- Vier Kurzlektionen auf Basis der bereitgestellten Edumap.
- 40 Quizfragen, sechs zufällige Fragen je Runde, gemischte Antwortreihenfolge.
- Pro Frage 20 Sekunden; alternativ 40 Sekunden oder Lernmodus ohne Timer.
- Zeitablauf und Neuladen setzen den Countdown nicht zurück. Lokale Zeitmessung ist kein manipulationssicherer Prüfungsmodus und verhindert KI-Nutzung nicht zuverlässig.
- Automatische Quizbewertung: `max(1, round(15 × richtig / 6))`, ausdrücklich Übungsskala.
- Sechs Schreibaufgaben mit zwei eigens verfassten Übungsreden, Wortzähler, lokal gespeicherten Entwürfen und Textdownload.
- BVB-Wappen als kleines Fan-Detail. Keine Originalarbeitsblätter oder Schülerarbeiten im öffentlichen Repository.

## Status der freien Schreibkorrektur

**Vorbereitet, noch nicht aktiviert.** `config.js` hat absichtlich keinen Endpunkt. Ohne einen bereitgestellten API-Zugang und einen veröffentlichten Worker werden keine Texte an eine KI übermittelt und keine Textnoten erfunden.

`worker.js` enthält den geschützten Korrekturdienst für Cloudflare Workers. Schlüssel bleiben dort als Secrets. GitHub Pages allein kann keine geheimen API-Schlüssel schützen oder serverseitige Korrektur ausführen.

### Freischaltung

1. Einen OpenAI-API-Zugang mit nutzbarem Kontingent und einen Cloudflare-Account bereitstellen. Es wurden keine kostenpflichtigen Verträge abgeschlossen und keine echten API-Korrekturen durchgeführt.
2. Im Projektverzeichnis `npx wrangler deploy` ausführen. `wrangler.toml` legt eine SQLite Durable Object Quota an. Den Modellnamen auf ein im eigenen API-Projekt verfügbares Modell einstellen; aktuell ist `gpt-4.1-mini` konfiguriert.
3. `npx wrangler secret put OPENAI_API_KEY`: API-Schlüssel ausschließlich in die geschützte Eingabe schreiben.
4. Pro Lernendem einen zufälligen, nicht personenbezogenen Code mit mindestens 16 Zeichen erzeugen. Die kommagetrennte Liste über `npx wrangler secret put ACCESS_CODES` hinterlegen. Codes separat an Lernende verteilen, niemals in GitHub committen.
5. `ALLOWED_ORIGIN` ist für `https://herrhahn.github.io` vorbereitet. CORS ersetzt keine Authentifizierung; zusätzlich werden die Codes serverseitig geprüft.
6. Die bestätigte Worker-URL mit `/grade` in `config.js` als `GRADING_ENDPOINT` eintragen und die Website erneut veröffentlichen.
7. Vor Klasseneinsatz echte fachliche Probebewertungen durchführen: gute, mittlere, schwache, unpassende und manipulative Texte; Ergebnis anhand der Raster kontrollieren. Automatische Bewertungen bleiben unverbindliche Lernrückmeldungen.

Der Dienst akzeptiert ausschließlich sechs bekannte Aufgaben, maximal 16.000 Zeichen/40 KB Anfrage. Das dauerhafte Limit beträgt 12 Anfragen pro Code und 300 für den Kurs pro UTC-Tag, mindestens 75 Sekunden Abstand pro Code. Fehlgeschlagene Versuche zählen ebenfalls, um Kostenmissbrauch zu begrenzen. Es werden nur Hashes, Zähler und Zeitpunkte gespeichert, keine Schülertexte. Ein Alarm löscht den Zähler nach 25 Stunden ohne neue Anfrage. Zusätzlich API-Kostenlimit im Anbieterprojekt einrichten. Ein Kurscode ist kein Identitätsnachweis.

## Bewertungsgrundlage

Lehrkraftdateien: `Sprache.pdf` und `E_Hinweise_zur_Bewertung_der_inhaltlichen_Leistung.pdf`, IQB-Hinweise vom 08.11.2021. Maßstab didaktisch an das grundlegende Training der Klasse 11 angepasst.

- Inhalt: Raster **Schreiben**, Teilaufgabe 1 / 2 / 3 **gestaltendes Schreiben** passend zur Aufgabe. Nicht das Sprachmittlungsraster.
- Sprache: Lexik, Grammatik und Textgestaltung gleichwertig; Bandbreite bei Lexik/Grammatik ausschlaggebend; Orthografie integriert.
- **Vorläufige, ausdrücklich offengelegte Kursgewichtung:** 40 % Inhalt und 60 % Sprache. Diese Gesamtgewichtung stammt nicht aus den PDFs und kann auf Wunsch geändert werden.
- Einzelkategorien 0–15 entsprechend den Rastern, Gesamtdarstellung wie gewünscht mindestens 1 und höchstens 15. Eine angehobene Nullleistung wird gekennzeichnet. Keine Bewertung leerer Texte, keine bloße Stichwortzählung für freie Texte, keine Behauptung einer amtlichen Note.
- Modellantwort als strukturiertes JSON; Server und Browser prüfen gültige Zahlen und Felder. Korrekturbelege müssen tatsächlich im eingereichten Text vorkommen.

## Datenschutz und Quellen

Keine Konten, Analyse-Tracker oder zentrale Schülerdatenbank. Entwürfe und Resultate im lokalen Browser; Quiz ohne KI-Aufruf. Nur explizit abgeschickte Schreibtexte gehen über Cloudflare an OpenAI mit `store: false`. Das ist kein Versprechen vollständiger Protokollfreiheit beim Anbieter. Keine persönlichen Daten eingeben. Vor Aktivierung schulische Freigaben und Bedingungen für den tatsächlichen Einsatz klären.

Grundlage: Edumap „11BG Making A Difference“, bereitgestelltes `Map.zip` (nicht hochgeladen): Operatorenliste, Rhetorical Devices, Obama, Bill Gates, Gap Years, „Bühne statt Bürojob“, „Paula hilft ein Jahr lang in Südafrika“. Kurze neue Paraphrasen; keine Veröffentlichung der PDFs. Ältere Finanzangaben nicht als aktuelle allgemeine Regeln übernommen. Mediation ist nicht als Klausurteil eingeführt.

BVB-Wappen: [Wikimedia Commons, Borussia Dortmund logo.svg](https://commons.wikimedia.org/wiki/File:Borussia_Dortmund_logo.svg), aktuelle Datei dort als Original von bvb.de dokumentiert, PD-textlogo; Markenrechte bleiben unberührt. Lokal eingebunden, keine Drittanbieteranfrage beim Laden.

API-Format: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Quota: [Cloudflare Durable Objects Storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

## Lokal prüfen

`python3 -m http.server 8765` und `http://127.0.0.1:8765` öffnen. `npm test` prüft Bewertung, Inhaltskonsistenz, Authentifizierung, Anfragegrenzen, Fehlerbehandlung und Quota. API-Tests verwenden simulierte Antworten; sie ersetzen keine echten Qualitätsprüfungen des Modells. GitHub Pages: Branch `main`, Ordner `/ (root)`.
