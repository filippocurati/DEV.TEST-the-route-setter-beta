using System.Collections.Concurrent;

namespace TheRouteSetter.Api.Services.ConvexHull;

/// <summary>
/// Implementa una coda concorrente in memoria per l'elaborazione progressiva dei collider.
/// </summary>
public sealed class ColliderJobStore : IColliderJobStore
{
    private readonly ConcurrentQueue<ColliderJob> jobs = new();
    private readonly ConcurrentDictionary<string, ColliderProcessingStatus> statuses = new(StringComparer.Ordinal);
    private bool initialDiscoveryCompleted;

    /// <inheritdoc />
    public ColliderProcessingStatus GetStatus(string holdId, bool colliderFileExists)
    {
        var discoveryCompleted = Volatile.Read(ref initialDiscoveryCompleted);
        return statuses.TryGetValue(holdId, out var status)
            ? status
            : discoveryCompleted ? ColliderProcessingStatus.Failed
            : colliderFileExists ? ColliderProcessingStatus.Ready : ColliderProcessingStatus.Missing;
    }

    /// <inheritdoc />
    public void CompleteInitialDiscovery() => Volatile.Write(ref initialDiscoveryCompleted, true);

    /// <inheritdoc />
    public void SetStatus(string holdId, ColliderProcessingStatus status)
    {
        statuses[holdId] = status;
    }

    /// <inheritdoc />
    public void SetPending(string holdId, string modelPath)
    {
        statuses[holdId] = ColliderProcessingStatus.Pending;
        jobs.Enqueue(new ColliderJob(holdId, modelPath));
    }

    /// <inheritdoc />
    public bool TryDequeue(out ColliderJob? job) => jobs.TryDequeue(out job);
}
