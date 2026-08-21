using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace TheRouteSetter.Api.Models;

/// <summary>
/// Descrive una presa disponibile nel catalogo senza includere il contenuto del modello GLB.
/// </summary>
/// <param name="Id">Identificativo coincidente con il nome della cartella Hold.</param>
/// <param name="PreviewUrl">URL dell'anteprima, se disponibile.</param>
/// <param name="ModelUrl">URL per il caricamento differito del modello GLB.</param>
/// <param name="ColliderUrl">URL del collider, disponibile quando lo stato e Ready.</param>
/// <param name="ColliderStatus">Stato corrente del collider pre-calcolato.</param>
/// <param name="OptionalAssetUrls">URL degli eventuali asset aggiuntivi trovati nella cartella.</param>
public sealed record HoldManifest(
    string Id,
    string? PreviewUrl,
    string ModelUrl,
    string? ColliderUrl,
    ColliderAvailability ColliderStatus,
    IReadOnlyList<string> OptionalAssetUrls);

/// <summary>
/// Indica se il collider pre-calcolato di una presa puo essere scaricato.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ColliderAvailability
{
    /// <summary>
    /// Il file collider non e ancora disponibile.
    /// </summary>
    Missing,

    /// <summary>
    /// Il collider e in attesa di verifica o generazione.
    /// </summary>
    Pending,

    /// <summary>
    /// Il file collider e disponibile.
    /// </summary>
    Ready,

    /// <summary>
    /// La verifica o generazione del collider non e riuscita.
    /// </summary>
    Failed
}

/// <summary>
/// Identifica un file statico autorizzato per il download.
/// </summary>
/// <param name="Path">Percorso fisico completo del file.</param>
/// <param name="ContentType">Tipo MIME restituito al client.</param>
public sealed record AssetFile(string Path, string ContentType);

/// <summary>
/// Identifica il modello sorgente di una presa da elaborare in background.
/// </summary>
/// <param name="Id">Identificativo della presa.</param>
/// <param name="ModelPath">Percorso assoluto del modello GLB.</param>
public sealed record HoldModelAsset(string Id, string ModelPath);

/// <summary>
/// Rappresenta un evento diagnostico inviato dal frontend.
/// </summary>
/// <param name="Level">Livello standard .NET dichiarato dal frontend.</param>
/// <param name="Category">Categoria funzionale dell'evento.</param>
/// <param name="Message">Messaggio sintetico non sensibile.</param>
/// <param name="Component">Componente frontend che ha prodotto l'evento.</param>
/// <param name="Context">Contesto diagnostico limitato e facoltativo.</param>
public sealed record FrontendLogRequest(
    LogLevel Level,
    [Required, StringLength(80, MinimumLength = 1)] string Category,
    [Required, StringLength(2000, MinimumLength = 1)] string Message,
    [Required, StringLength(80, MinimumLength = 1)] string Component,
    IReadOnlyDictionary<string, string>? Context = null);

/// <summary>
/// Contratto sicuro restituito al client quando il backend intercetta un errore.
/// </summary>
/// <param name="ErrorId">Identificativo univoco correlabile al log server-side.</param>
/// <param name="RequestId">Identificativo della richiesta HTTP.</param>
/// <param name="Message">Messaggio comprensibile privo di dettagli tecnici.</param>
public sealed record ErrorResponse(string ErrorId, string RequestId, string Message);
