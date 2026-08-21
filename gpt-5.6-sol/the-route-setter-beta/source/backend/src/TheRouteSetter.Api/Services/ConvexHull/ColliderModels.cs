using System.Text.Json.Serialization;

namespace TheRouteSetter.Api.Services.ConvexHull;

/// <summary>
/// Rappresenta il formato persistito e consumabile da Rapier nel browser.
/// </summary>
/// <param name="SourceHash">Hash SHA-256 del GLB sorgente con prefisso sha256.</param>
/// <param name="Vertices">Coordinate XYZ contigue dei vertici unici dell'hull.</param>
/// <param name="Indices">Indici triangolari delle facce dell'hull.</param>
public sealed record ColliderDocument(
    [property: JsonPropertyName("sourceHash")] string SourceHash,
    [property: JsonPropertyName("vertices")] double[] Vertices,
    [property: JsonPropertyName("indices")] int[] Indices);

/// <summary>
/// Contiene vertici e indici triangolari prodotti dal calcolo geometrico.
/// </summary>
/// <param name="Vertices">Coordinate XYZ contigue.</param>
/// <param name="Indices">Indici delle facce triangolari.</param>
public sealed record ConvexHullGeometry(double[] Vertices, int[] Indices);

/// <summary>
/// Esito dell'elaborazione di un singolo modello.
/// </summary>
public enum ColliderProcessingResult
{
    /// <summary>
    /// Un collider coerente era gia disponibile.
    /// </summary>
    Reused,

    /// <summary>
    /// Il collider e stato generato o rigenerato.
    /// </summary>
    Generated
}

/// <summary>
/// Stato volatile della verifica o generazione di un collider.
/// </summary>
public enum ColliderProcessingStatus
{
    /// <summary>
    /// Nessun collider e noto.
    /// </summary>
    Missing,

    /// <summary>
    /// La presa attende o sta eseguendo l'elaborazione.
    /// </summary>
    Pending,

    /// <summary>
    /// Il collider e pronto e coerente.
    /// </summary>
    Ready,

    /// <summary>
    /// L'elaborazione non e riuscita.
    /// </summary>
    Failed
}

/// <summary>
/// Rappresenta un modello accodato per l'elaborazione.
/// </summary>
/// <param name="HoldId">Identificativo della presa.</param>
/// <param name="ModelPath">Percorso assoluto del GLB.</param>
public sealed record ColliderJob(string HoldId, string ModelPath);
