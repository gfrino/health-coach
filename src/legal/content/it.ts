import { DEVELOPER as D, LEGAL_UPDATED, type LegalDoc } from '../developer';

/**
 * Documenti legali (IT). Bozza redatta sul funzionamento reale dell'app: da far verificare
 * a un consulente legale prima della pubblicazione sugli store. Tenere allineate le 4 lingue
 * e aggiornare quando cambiano i flussi di dati (es. backend della fase 8).
 */
const contact = `${D.name}, ${D.street}, ${D.city}, ${D.country.it} · ${D.email}`;

export const it: Record<LegalDoc, string> = {
  terms: `# Termini e condizioni d'uso

Ultimo aggiornamento: ${LEGAL_UPDATED}

## 1. Chi siamo
L'app AlbA è sviluppata e distribuita da ${contact} ("noi"). Usando l'app accetti questi termini.

## 2. Che cos'è l'app
AlbA è un coach di benessere personale: legge i dati che scegli di condividere (Apple Health o Health Connect, profilo, diario, documenti), li conserva cifrati sul tuo telefono e ti dà consigli su stile di vita, sonno, attività e alimentazione con l'aiuto di un'intelligenza artificiale.

**AlbA non è un dispositivo medico e non fornisce diagnosi, terapie o pareri medici.** Leggi anche le **Avvertenze legali**.

## 3. Requisiti
- Devi avere almeno 16 anni.
- Sei responsabile della correttezza dei dati che inserisci e del corretto uso dell'app.

## 4. Intelligenza artificiale e servizi di terzi
- Di default l'app usa l'AI del telefono (Apple Intelligence o Gemini Nano): funziona sul dispositivo.
- Se scegli un servizio AI online (OpenAI, Anthropic, Google), l'app lo contatta direttamente dal telefono con la **tua** chiave di accesso. Il rapporto con quel servizio è regolato dai suoi termini; eventuali costi sono addebitati da quel fornitore sul tuo account. Non siamo responsabili della disponibilità, dei costi o delle risposte di servizi di terzi.
- Custodisci la tua chiave di accesso: è salvata cifrata sul telefono e non la riceviamo mai.
- Le risposte dell'AI possono essere incomplete o sbagliate: valutale sempre con senso critico.

## 5. Uso consentito
Puoi usare l'app per scopi personali. Non è consentito: usarla per fornire servizi sanitari a terzi, aggirarne le protezioni, decompilarla oltre quanto permesso dalla legge o usarla in violazione della legge.

## 6. Proprietà intellettuale
L'app, il suo codice, il design e i contenuti sono di ${D.name} o dei rispettivi titolari. I marchi di terzi (es. Apple Health, OpenAI, Anthropic, Google, Withings) appartengono ai rispettivi proprietari e sono citati solo per indicare la compatibilità.

## 7. Disponibilità e modifiche
Possiamo aggiornare, modificare o interrompere l'app o singole funzioni. Le funzioni indicate come "presto disponibile" non sono garantite.

## 8. Responsabilità
Nei limiti consentiti dalla legge svizzera escludiamo ogni responsabilità per danni derivanti dall'uso dell'app, dalle risposte dell'AI o da servizi di terzi, salvo dolo o colpa grave. Restano salvi i diritti inderogabili dei consumatori.

## 9. Modifiche dei termini
Possiamo modificare questi termini; la versione in vigore è sempre disponibile nell'app. Continuando a usare l'app dopo una modifica, accetti i nuovi termini.

## 10. Diritto applicabile e foro
Si applica il diritto svizzero. Foro competente: Locarno, fatti salvi i fori imperativi previsti per i consumatori.

## Contatti
${contact}
`,

  privacy: `# Informativa sulla privacy

Ultimo aggiornamento: ${LEGAL_UPDATED}

## Il principio
**I tuoi dati di salute restano sul tuo telefono.** AlbA non ha un server per i dati di salute: non li riceviamo, non li vediamo e non li vendiamo. Niente pubblicità, niente profilazione, nessuno strumento di analisi o tracciamento.

## Titolare del trattamento
${contact}. Si applicano la legge federale svizzera sulla protezione dei dati (nLPD) e, per gli utenti nell'UE/SEE, il GDPR.

## Quali dati tratta l'app (sul telefono)
- **Dati di salute** che autorizzi da Apple Health o Health Connect (es. passi, sonno, frequenza cardiaca, peso, allenamenti).
- **Profilo**: nome, età, altezza, obiettivi, condizioni, farmaci, allergie che inserisci.
- **Diario**: umore, energia, sintomi e note (scritti da te o annotati dal coach su tua richiesta).
- **Documenti**: referti, esami e foto che aggiungi o condividi con l'app, con i valori e il riassunto che l'AI ne ricava.
- **Conversazioni** con il coach.

Sono conservati in un database **cifrato** (SQLCipher, AES-256) sul dispositivo; la chiave è nel portachiavi protetto del sistema e non lascia il telefono. Il backup automatico nel cloud di questi dati è disattivato.

## Quando i dati lasciano il telefono
Solo nei casi seguenti, e sempre direttamente dal tuo telefono al servizio che hai scelto (mai attraverso di noi):

1. **AI online** (OpenAI, Anthropic, Google), solo se la attivi: a ogni domanda l'app invia il tuo messaggio, un riepilogo dei dati pertinenti (es. medie di sonno e passi) e gli eventuali allegati. Se il coach è proattivo, lo stesso riepilogo viene inviato anche una volta al giorno per preparare il check-in del mattino. Ogni documento che aggiungi alla Cartella salute viene inoltre inviato una volta, perché l'AI ne legga i valori e lo riassuma; con l'AI del telefono il testo di PDF e foto viene letto sul dispositivo. Il fornitore li tratta secondo la propria informativa; i server possono trovarsi fuori dalla Svizzera e dall'UE (es. USA). Con OpenAI chiediamo di non conservare le conversazioni (\`store: false\`). Con l'**AI del telefono** (predefinita) nulla lascia il dispositivo.
2. **Voce**: la trascrizione avviene sul telefono quando possibile; altrimenti usa il servizio vocale di Apple o Google. Nella **conversazione a voce con OpenAI**, l'audio è inviato in tempo reale a OpenAI.
3. **Condivisione ed esportazione** che avvii tu (es. aprire un documento in un'altra app).

## Autorizzazioni
Salute, microfono, riconoscimento vocale, fotocamera e foto sono chiesti solo quando servono e puoi revocarli in ogni momento nelle impostazioni del telefono.

## Conservazione e cancellazione
I dati restano finché li conservi. Puoi eliminare singoli elementi nell'app; disinstallando l'app il database cifrato viene eliminato. I dati presso i fornitori AI sono regolati dalle loro politiche di conservazione.

## I tuoi diritti
Hai diritto di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione. Poiché i dati sono sul tuo dispositivo, puoi esercitare la maggior parte di questi diritti direttamente nell'app. Per domande: ${D.email}. Puoi rivolgerti anche all'Incaricato federale della protezione dei dati (IFPDT) o all'autorità del tuo paese.

## Minori
L'app non è destinata a persone sotto i 16 anni.

## Modifiche
Aggiorneremo questa informativa se cambia il modo in cui vengono trattati i dati; la data in alto indica l'ultima revisione.
`,

  disclaimer: `# Avvertenze legali

Ultimo aggiornamento: ${LEGAL_UPDATED}

## Non è un parere medico
AlbA è un'app di benessere e informazione. **Non è un dispositivo medico** e non sostituisce medici, farmacisti o altri professionisti sanitari. Non fornisce diagnosi, non prescrive terapie e non va usata per decidere cure.

## Farmaci e terapie
Non iniziare, sospendere o modificare farmaci, integratori o terapie in base ai suggerimenti dell'app: parlane sempre con il tuo medico.

## Emergenze
In caso di emergenza chiama subito il **144** (Svizzera) o il **112** (Europa), oppure il tuo medico. Non usare l'app per le emergenze.

## Intelligenza artificiale
I suggerimenti sono generati da modelli di intelligenza artificiale che possono sbagliare, essere incompleti o non aggiornati. Valutali con senso critico.

## Approcci e diete
Gli approcci non convenzionali (es. medicina tradizionale cinese, ayurveda, naturopatia) e le diete (es. chetogenica, Healthy Keto, senza lectine, carnivora) sono proposti come tua scelta personale e in modo complementare. Alcune affermazioni dei rispettivi autori non sono supportate da prove scientifiche. Con malattie, farmaci, gravidanza o allattamento chiedi il parere del medico prima di cambiare alimentazione o iniziare un digiuno.

## Dati
Le misure dipendono dai dispositivi e dalle app di origine e possono contenere errori o lacune.

## Marchi
Apple Health, Apple Intelligence, Health Connect, OpenAI, Anthropic, Google, Gemini, Withings e gli altri marchi citati appartengono ai rispettivi proprietari. AlbA non è affiliato né approvato da loro.
`,

  impressum: `# Impressum

**${D.name}**
${D.street}
${D.city}
${D.country.it}

Titolare: ${D.owner}

E-mail: ${D.email}
Telefono: ${D.phone}
Sito: ${D.website}

IDI (UID): ${D.uid}
Registro di commercio: ${D.commercialRegister}

## Responsabile dei contenuti
${D.owner}, indirizzo come sopra.

## Esclusione di responsabilità
Nonostante la cura nella realizzazione dell'app, non garantiamo l'esattezza, la completezza e l'attualità dei contenuti. I collegamenti a siti e servizi di terzi sono fuori dal nostro controllo.
`,
};
