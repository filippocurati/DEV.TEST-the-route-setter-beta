namespace TheRouteSetter.Backend.Models;

/// <summary>
/// Rappresenta le informazioni sulla parete principale.
/// </summary>
public class WallInfo
{
    /// <summary>
    /// Identificativo della parete.
    /// </summary>
    public string Id { get; set; } = "main-wall";

    /// <summary>
    /// Nome visualizzato della parete.
    /// </summary>
    public string Name { get; set; } = "Parete principale";

    /// <summary>
    /// URL per il download del modello 3D della parete.
    /// </summary>
    public string ModelUrl { get; set; } = string.Empty;
}

/// <summary>
/// Rappresenta una presa nel catalogo.
/// </summary>
public class HoldManifest
{
    /// <summary>
    /// Identificativo della presa (es. "Hold1").
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// URL dell'immagine di anteprima (file PREV_).
    /// </summary>
    public string PreviewUrl { get; set; } = string.Empty;

    /// <summary>
    /// URL del modello 3D GLB della presa.
    /// </summary>
    public string ModelUrl { get; set; } = string.Empty;

    /// <summary>
    /// URL del file collider Convex Hull pre-calcolato.
    /// </summary>
    public string ColliderUrl { get; set; } = string.Empty;

    /// <summary>
    /// Indica se il collider per questa presa è già disponibile.
    /// </summary>
    public bool ColliderReady { get; set; }
}

/// <summary>
/// Modello per la ricezione di eventi di log dal frontend.
/// </summary>
public class LogEntry
{
    /// <summary>
    /// Livello di severità del log.
    /// </summary>
    public string Level { get; set; } = "Information";

    /// <summary>
    /// Categoria dell'evento.
    /// </summary>
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Messaggio di log.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Componente applicativo che ha generato l'evento.
    /// </summary>
    public string Component { get; set; } = string.Empty;

    /// <summary>
    /// Dettagli aggiuntivi opzionali.
    /// </summary>
    public string? Details { get; set; }
}

/// <summary>
/// Risposta standard per gli errori del backend.
/// </summary>
public class ErrorResponse
{
    /// <summary>
    /// Identificativo univoco dell'errore per correlazione con i log server.
    /// </summary>
    public string ErrorId { get; set; } = string.Empty;

    /// <summary>
    /// Messaggio di errore comprensibile e privo di dettagli tecnici.
    /// </summary>
    public string Message { get; set; } = string.Empty;
}