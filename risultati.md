# RISULTATI


## FASE 0 - 1° esecuzione
### gpt-5.3-codex 
- primo a finire
- finito con blocco per versione MIConvexHull

### gpt-5.6-sol
- secondo a finire
- finito con blocchi per .NET non installato e incompatibilità Node.js e Vite/Vitest

### deepseek-v4-flash
- terzo a finire
- finito con successo ma forzato vincoli tecnici:
  - da .NET 8 a .NET 6
  - da Vitest 1.6 a Vitest 0.34.6 per incompatibilità con Node.js v16
  - MIConvexHull@1.1.19 risolto a 1.1.19.504
  
 ## FASE 0 - 2° esecuzione
- modificata REQ-DEP-004

### deepseek-v4-flash
- primo a finire ma bloccato perché non ha installato le versioni richieste dalla nuova specifica

### gpt-5.6-sol
- secondo a finire, ha finito con successo, il problema di .NET 8 mancante sulla macchina l'ha risolto installandolo in una cartella locale C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe, così ha completato la fase
lo stesso per Node che è stato installato in C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64

### gpt-5.3-codex 
- terzo a finire, ha aggirato il problema dei framework come gpt-5.6-sol, solo con il doppio di tempo


Tutti e 3 i risultati della seconda esecuzione della fase zero erano consistenti e validi


## FASE 1 - 1° esecuzione

### deepseek-v4-flash
- elaborazione interrotta dopo 77 minuti, probabilmente per problemi di connessione, anche se le richieste agli altri modelli funzionano correttamente
- seconda elaborazione finita con successo dopo 7 minuti ma anche qui l'endpoint  http://localhost:5118/api/holds/Hold1/model restituisce un 404 perché leggeva anche lui da cartelle in percorsi relativi
- modifica per lettura da percorsi esterni molto lunga
- modifica interrotta per tempi bloccanti, ho richiesto il codice da applicare al appsettings.json per poter procedere, applicata in autonomia e corretto la lettura dei file, ora la fase 1 può essere considerata completata

Interrompo momentaneamente lo sviluppo con deepseek in quanto non supporta le richieste. 
Al momento resta fermo alla fase 1 completata .

### gpt-5.6-sol

- primo a finire in 10 minuti con esito positivo, tutto corretto
- ha aggiunto un endpoint anche per ottenere la preview della presa in png
- swagger meglio documentato

### gpt-5.3-codex 

- secondo a finire in 17 minuti
- no endpoint preview ma i file della preview arriva con l'endpoint holds
- endpoint documentati peggio
- non leggeva i file presenti nelle cartelle esterne al progetto ma li cercava nel path relativo dell'applicazione, corretto in un secondo momento

## FASE 2 - 1° esecuzione

Esecuzione partita prima per gpt-5.3-codex e gpt-5.6-sol, DeepSeek fermo a fase 1

### deepseek-v4-flash

### gpt-5.6-sol
- finito come secondo in 18 minuti
- completato tutto correttamente con generazione dei collider
- lettura corretta dalle cartelle esterne

### gpt-5.3-codex 
- finito per primo in 12 minuti con esito positivo
- implementazione totalmente corretta con generazione dei collider json per le prese


## FASE 3 - 1° esecuzione

### deepseek-v4-flash

### gpt-5.6-sol
- finito come secondo in 21 minuti
- fase completata con successo , in run non si vede più l'indicazione dell'url in ascolto perché tutto spostato su file di log

### gpt-5.3-codex 
- finito per primo in 15 minuti con esito positivo
- fase completata con successo , in run non si vede più l'indicazione dell'url in ascolto perché tutto spostato su file di log

## FASE 4 - 1° esecuzione

### deepseek-v4-flash

### gpt-5.6-sol
- finito con successo con pari tempo rispetto a codex

### gpt-5.3-codex 
- finito con successo con pari tempo rispetto a codex

## FASE 5 - 1° esecuzione

### deepseek-v4-flash

### gpt-5.6-sol
- finito con successo in 14 minuti.
- la prima esecuzione non era stata completata perché era stato interpretato erronamento di impostare gpt-5-6-sol come modello predefinito di opencode, e questo è stato l'intervento svolto , al secondo giro l'interpretazione è stata corretta

### gpt-5.3-codex 
- finito con successo dopo 7 minuti


## FASE 6 - 1° esecuzione

### deepseek-v4-flash

### gpt-5.6-sol
- comletato con successo in 14 minuti
- la scala dei modelli GLB però non è conforme e le prese ora vengono visualizzate molto più grandi della parete
- le prese vengono tolte ed aggiunte correttamente alla scenza, ora si sovrappongono ma le regole di non sovrapposizione sono previste nelle prossime fasi
- la fase si può considerare correttamente implementata


### gpt-5.3-codex 
- comletato con successo in 18 minuti
- errore lato client nella visualizzazione della presa e nell'utilizzo in scena, 3 iterazioni al momento non hanno corretto l'errore