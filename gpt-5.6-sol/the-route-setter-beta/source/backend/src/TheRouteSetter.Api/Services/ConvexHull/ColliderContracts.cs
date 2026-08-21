using System.Numerics;

namespace TheRouteSetter.Api.Services.ConvexHull;

/// <summary>
/// Estrae i vertici geometrici da un modello GLB.
/// </summary>
public interface IGltfVertexReader
{
    /// <summary>
    /// Legge tutte le posizioni definite dalle primitive mesh del modello.
    /// </summary>
    IReadOnlyList<Vector3> ReadVertices(string modelPath);
}

/// <summary>
/// Calcola un inviluppo convesso tridimensionale.
/// </summary>
public interface IConvexHullBuilder
{
    /// <summary>
    /// Costruisce vertici unici e facce triangolari dell'hull.
    /// </summary>
    ConvexHullGeometry Build(IReadOnlyList<Vector3> vertices);
}

/// <summary>
/// Verifica, genera e persiste il collider di una presa.
/// </summary>
public interface IColliderProcessor
{
    /// <summary>
    /// Elabora il modello soltanto quando il suo hash e cambiato.
    /// </summary>
    Task<ColliderProcessingResult> ProcessAsync(
        string holdId,
        string modelPath,
        CancellationToken cancellationToken);
}

/// <summary>
/// Mantiene coda e stato volatile dei collider durante la vita del processo.
/// </summary>
public interface IColliderJobStore
{
    /// <summary>
    /// Restituisce lo stato noto, usando la presenza file solo prima della scansione iniziale.
    /// </summary>
    ColliderProcessingStatus GetStatus(string holdId, bool colliderFileExists);

    /// <summary>
    /// Aggiorna lo stato di una presa.
    /// </summary>
    void SetStatus(string holdId, ColliderProcessingStatus status);

    /// <summary>
    /// Accoda una presa e la marca come in elaborazione.
    /// </summary>
    void SetPending(string holdId, string modelPath);

    /// <summary>
    /// Estrae il prossimo lavoro disponibile.
    /// </summary>
    bool TryDequeue(out ColliderJob? job);
}
