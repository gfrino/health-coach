import { DEVELOPER as D, LEGAL_UPDATED, type LegalDoc } from '../developer';

/** Rechtliche Dokumente (DE). Mit it.ts (Referenzversion) abgleichen. */
const contact = `${D.name}, ${D.street}, ${D.city}, ${D.country.de} · ${D.email}`;

export const de: Record<LegalDoc, string> = {
  terms: `# Nutzungsbedingungen

Letzte Aktualisierung: ${LEGAL_UPDATED}

## 1. Wer wir sind
Die App AlbA wird von ${contact} ("wir") entwickelt und vertrieben. Mit der Nutzung der App akzeptierst du diese Bedingungen.

## 2. Was die App ist
AlbA ist ein persönlicher Wellness-Coach: Die App liest die Daten, die du freigibst (Apple Health oder Health Connect, Profil, Tagebuch, Dokumente), speichert sie verschlüsselt auf deinem Telefon und gibt dir mithilfe künstlicher Intelligenz Tipps zu Lebensstil, Schlaf, Aktivität und Ernährung.

**AlbA ist kein Medizinprodukt und stellt keine Diagnosen, Therapien oder ärztlichen Ratschläge bereit.** Lies bitte auch den **Rechtlichen Hinweis**.

## 3. Voraussetzungen
- Du musst mindestens 16 Jahre alt sein.
- Du bist für die Richtigkeit der eingegebenen Daten und die korrekte Nutzung der App verantwortlich.

## 4. Künstliche Intelligenz und Dienste Dritter
- Standardmässig nutzt die App die KI deines Telefons (Apple Intelligence oder Gemini Nano), die auf dem Gerät läuft.
- Wählst du einen Online-KI-Dienst (OpenAI, Anthropic, Google), kontaktiert die App ihn direkt von deinem Telefon mit **deinem** Zugangsschlüssel. Für dieses Verhältnis gelten die Bedingungen des Dienstes; allfällige Kosten verrechnet der Anbieter deinem Konto. Für Verfügbarkeit, Kosten oder Antworten von Drittdiensten sind wir nicht verantwortlich.
- Bewahre deinen Zugangsschlüssel sicher auf: Er wird verschlüsselt auf deinem Telefon gespeichert, wir erhalten ihn nie.
- Antworten der KI können unvollständig oder falsch sein: Prüfe sie immer kritisch.

## 5. Erlaubte Nutzung
Du darfst die App für private Zwecke nutzen. Nicht erlaubt ist, damit Gesundheitsdienstleistungen für Dritte zu erbringen, Schutzmechanismen zu umgehen, sie über das gesetzlich Erlaubte hinaus zu dekompilieren oder sie rechtswidrig zu nutzen.

## 6. Geistiges Eigentum
App, Code, Design und Inhalte gehören ${D.name} oder den jeweiligen Rechteinhabern. Marken Dritter (z. B. Apple Health, OpenAI, Anthropic, Google, Withings) gehören ihren Inhabern und werden nur zur Angabe der Kompatibilität genannt.

## 7. Verfügbarkeit und Änderungen
Wir können die App oder einzelne Funktionen aktualisieren, ändern oder einstellen. Als "demnächst verfügbar" markierte Funktionen sind nicht garantiert.

## 8. Haftung
Soweit nach Schweizer Recht zulässig, schliessen wir jede Haftung für Schäden aus der Nutzung der App, aus KI-Antworten oder aus Diensten Dritter aus, ausser bei Vorsatz oder grober Fahrlässigkeit. Zwingende Konsumentenrechte bleiben vorbehalten.

## 9. Änderungen der Bedingungen
Wir können diese Bedingungen ändern; die gültige Fassung ist immer in der App verfügbar. Wenn du die App nach einer Änderung weiter nutzt, akzeptierst du die neuen Bedingungen.

## 10. Anwendbares Recht und Gerichtsstand
Es gilt Schweizer Recht. Gerichtsstand ist Locarno, vorbehaltlich zwingender Gerichtsstände für Konsumenten.

## Kontakt
${contact}
`,

  privacy: `# Datenschutzerklärung

Letzte Aktualisierung: ${LEGAL_UPDATED}

## Der Grundsatz
**Deine Gesundheitsdaten bleiben auf deinem Telefon.** AlbA hat keinen Server für Gesundheitsdaten: Wir erhalten sie nicht, sehen sie nicht und verkaufen sie nicht. Keine Werbung, kein Profiling, keine Analyse- oder Tracking-Tools.

## Verantwortliche Stelle
${contact}. Es gilt das Schweizer Datenschutzgesetz (DSG) und für Nutzerinnen und Nutzer in der EU/im EWR die DSGVO.

## Welche Daten die App verarbeitet (auf dem Telefon)
- **Gesundheitsdaten**, die du aus Apple Health oder Health Connect freigibst (z. B. Schritte, Schlaf, Herzfrequenz, Gewicht, Trainings).
- **Ernährungstagebuch**: die Lebensmittel, die du oder der Coach einträgt, mit geschätzten Kalorien und Nährstoffen. Auf dem iPhone speichert die App sie, wenn du es einschaltest, auch in Apple Health, das auf deinem Telefon bleibt.
- **Profil**: Name, Alter, Grösse, Ziele, Erkrankungen, Medikamente und Allergien, die du eingibst.
- **Tagebuch**: Stimmung, Energie, Symptome und Notizen (von dir geschrieben oder auf deinen Wunsch vom Coach notiert).
- **Dokumente**: Befunde, Laborwerte und Fotos, die du hinzufügst oder mit der App teilst, mit den Werten und der Zusammenfassung, die die KI daraus liest.
- **Gespräche** mit dem Coach und sein Gedächtnis: kurze Zusammenfassungen früherer Gespräche und dauerhafte Fakten, die du ihm erzählt hast (in den Einstellungen einsehbar und löschbar).

Sie werden in einer **verschlüsselten** Datenbank (SQLCipher, AES-256) auf dem Gerät gespeichert; der Schlüssel liegt im geschützten Schlüsselbund des Systems und verlässt das Telefon nie. Das automatische Cloud-Backup dieser Daten ist deaktiviert.

## Wann Daten das Telefon verlassen
Nur in den folgenden Fällen und immer direkt von deinem Telefon an den gewählten Dienst (nie über uns):

1. **Online-KI** (OpenAI, Anthropic, Google), nur wenn du sie aktivierst: Bei jeder Frage sendet die App deine Nachricht, eine Zusammenfassung der relevanten Daten (z. B. Durchschnittswerte zu Schlaf und Schritten) und allfällige Anhänge. Ist der Coach proaktiv, wird diese Zusammenfassung zudem einmal täglich gesendet, um deinen Check-in am Morgen vorzubereiten. Jedes Dokument, das du deinen Gesundheitsunterlagen hinzufügst, wird zudem einmal gesendet, damit die KI seine Werte liest und es zusammenfasst; jedes abgeschlossene Gespräch wird zudem einmal gesendet, um eine Zusammenfassung zu schreiben und dauerhafte Fakten für das Gedächtnis des Coachs festzuhalten; mit der KI des Telefons wird der Text von PDFs und Fotos auf dem Gerät gelesen. Der Anbieter verarbeitet sie gemäss seiner eigenen Datenschutzerklärung; die Server können sich ausserhalb der Schweiz und der EU befinden (z. B. in den USA). Bei OpenAI verlangen wir, dass Gespräche nicht gespeichert werden (\`store: false\`). Mit der **KI des Telefons** (Standard) verlässt nichts das Gerät.
2. **Sprache**: Die Transkription erfolgt wenn möglich auf dem Telefon, sonst über den Sprachdienst von Apple oder Google. Im **Sprachgespräch mit OpenAI** wird das Audio in Echtzeit an OpenAI übertragen.
3. **Teilen und Exportieren**, das du selbst auslöst (z. B. ein Dokument in einer anderen App öffnen).

## Berechtigungen
Gesundheit, Mikrofon, Spracherkennung, Kamera und Fotos werden nur bei Bedarf angefragt und können jederzeit in den Einstellungen des Telefons widerrufen werden.

## Aufbewahrung und Löschung
Die Daten bleiben, solange du sie behältst. Einzelne Elemente kannst du in der App löschen; beim Deinstallieren der App wird die verschlüsselte Datenbank gelöscht. Für Daten bei KI-Anbietern gelten deren Aufbewahrungsregeln.

## Deine Rechte
Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Da die Daten auf deinem Gerät liegen, kannst du die meisten dieser Rechte direkt in der App ausüben. Fragen: ${D.email}. Du kannst dich auch an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) oder an die Behörde deines Landes wenden.

## Minderjährige
Die App richtet sich nicht an Personen unter 16 Jahren.

## Änderungen
Wir aktualisieren diese Erklärung, wenn sich die Datenverarbeitung ändert; das Datum oben zeigt die letzte Überarbeitung.
`,

  disclaimer: `# Rechtlicher Hinweis

Letzte Aktualisierung: ${LEGAL_UPDATED}

## Keine ärztliche Beratung
AlbA ist eine Wellness- und Informations-App. **Sie ist kein Medizinprodukt** und ersetzt weder Ärztinnen und Ärzte noch Apotheken oder andere Gesundheitsfachpersonen. Sie stellt keine Diagnosen, verschreibt keine Therapien und darf nicht für Behandlungsentscheide verwendet werden.

## Medikamente und Therapien
Beginne, beende oder ändere keine Medikamente, Nahrungsergänzungen oder Therapien aufgrund der Vorschläge der App: Sprich immer mit deiner Ärztin oder deinem Arzt.

## Notfälle
Rufe im Notfall sofort die **144** (Schweiz) oder die **112** (Europa) an oder wende dich an deine Ärztin bzw. deinen Arzt. Nutze die App nicht für Notfälle.

## Künstliche Intelligenz
Die Vorschläge werden von KI-Modellen erzeugt, die sich irren, unvollständig oder veraltet sein können. Prüfe sie kritisch.

## Ansätze und Ernährungsformen
Nicht-konventionelle Ansätze (z. B. Traditionelle Chinesische Medizin, Ayurveda, Naturheilkunde) und Ernährungsformen (z. B. ketogen, Healthy Keto, lektinfrei, carnivor) werden als deine persönliche Wahl und ergänzend angeboten. Einige Aussagen ihrer Urheber sind wissenschaftlich nicht belegt. Bei Erkrankungen, Medikamenten, Schwangerschaft oder Stillzeit frage deine Ärztin oder deinen Arzt, bevor du deine Ernährung umstellst oder fastest.

## Daten
Die Messwerte hängen von den Quellgeräten und -apps ab und können Fehler oder Lücken enthalten.

## Marken
Apple Health, Apple Intelligence, Health Connect, OpenAI, Anthropic, Google, Gemini, Withings und die anderen genannten Marken gehören ihren jeweiligen Inhabern. AlbA ist mit ihnen weder verbunden noch von ihnen empfohlen.
`,

  impressum: `# Impressum

**${D.name}**
${D.street}
${D.city}
${D.country.de}

Inhaber: ${D.owner}

E-Mail: ${D.email}
Telefon: ${D.phone}
Website: ${D.website}

UID: ${D.uid}
Handelsregister: ${D.commercialRegister}

## Verantwortlich für den Inhalt
${D.owner}, Adresse wie oben.

## Haftungsausschluss
Trotz sorgfältiger Entwicklung der App übernehmen wir keine Gewähr für Richtigkeit, Vollständigkeit und Aktualität der Inhalte. Links zu Websites und Diensten Dritter liegen ausserhalb unseres Einflussbereichs.
`,
};
