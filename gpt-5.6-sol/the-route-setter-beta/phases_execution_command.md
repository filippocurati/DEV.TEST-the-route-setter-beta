# Procedura esecuzione fase

## Vincoli in sviluppo fase

Leggi integralmente `sdd_istructions.md` e tutti i file in `sdd-specs`.
Implementa SOLO la fase che ti viene comunicata inerente al sdd-specs/03-piano-implementazione.md, senza anticipare fasi successive.
Rispetta 00-costituzione.md e 01-specifica-requisiti.md.

Tutte le implementazioni devono essere svolte nella cartella "source".
In questa cartella devono essere presenti tutti i file contenenti i sorgenti dell'applicazione.
Le cartelle contenenti i file statici dei modelli sono esterne alla cartella "source" e rispecchiano le strutture descritte nelle specifiche.

Ogniqualvolta devono essere modificati file di specifica per poter procedere con l'implementazione in maniera consistente e coerente con le specifiche, deve essere interrotto lo sviluppo della fase e la situazione considerata e notificata come un errore bloccante.

Qualora manchino framework o librerie che sono indicate nelle specifiche tecniche, procedi con l'installazione o l'aggiornamento direttamente sulla macchina. Se l'installazione o l'aggiornamento non vanno a buon fine considera la situazione bloccante.

## Output post implementazione fase

Al termine dell'implementazione della fase richiesta genera un file markdown che riepiloga il risultato delle implementazioni svolte. 
Riporta nel file le seguenti informazioni:
1) elenco file modificati;
2) requisiti REQ-* coperti;
3) test eseguiti per la fase e risultati di ciascun test, se i test vengono effettuati più volte, riporta tutto lo storico delle esecuzioni svolte;
4) eventuali limiti/blocchi riscontrati in fase di implementazione;
5) passi manuali per verificare personalmente la fase (comandi inclusi).

Nel caso in cui l'implementazione della fase sia stata completata con successo il file deve essere chiamato `Phase_[X]_implementation_done.md`.
Nel caso in cui l'implementazione della fase abbia riscontrato errori bloccanti che non sei riuscito a correggere anche con diverse iterazioni o blocchi dovuti a limiti tecnici architetturali, il file deve essere chiamato `Phase_[X]_implementation_block.md`. 

I file di risultato devono essere salvati nella cartella phases-outcome.

Non sovrascrivere o rimuovere mai file relativi al risultato di un'esecuzione di una fase, se un file con lo stesso nome esiste già, generalo con un suffisso che rappresenta un contatore dei tentativi di esecuzione.

Eccezione vincolante: la reimplementazione drag transazionale della FASE 9UX deve creare esattamente `Phase_9UX-bis_implementation_done.md` in caso di successo oppure `Phase_9UX-bis_implementation_block.md` in caso di blocco. Il file `Phase_9UX_implementation_done.md` deve essere mantenuto come storico e non deve essere sovrascritto, rimosso o rinominato.

Per entrambi i file al posto del placeholder [X] deve essere riportato il numero della fase processata.
Il contentuto del file generato deve rispettare i punti sopra indicati, nel caso di blocco a causa di errori deve essere ben documentato il punto 4 relativo ai problemi riscontrati.

Dopo aver processato la fase richiesta ed aver concluso le implementazioni con esito positivo o negativo (dopo aver svolto tutte le reiterazioni di correzioni necessarie), quando ritieni chiusa o bloccata l'implementazione della fase e dopo aver generato il file markdown di risultato, fermati in attesa del comando successivo su come procedere.
