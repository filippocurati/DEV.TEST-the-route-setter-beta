namespace TheRouteSetter.Application.ConvexHull;

public interface IColliderGenerationService
{
    Task<ColliderGenerationResult> EnsureColliderAsync(
        string modelAbsolutePath,
        string colliderAbsolutePath,
        CancellationToken cancellationToken = default);

    Task<bool> IsColliderCoherentAsync(
        string modelAbsolutePath,
        string colliderAbsolutePath,
        CancellationToken cancellationToken = default);
}
