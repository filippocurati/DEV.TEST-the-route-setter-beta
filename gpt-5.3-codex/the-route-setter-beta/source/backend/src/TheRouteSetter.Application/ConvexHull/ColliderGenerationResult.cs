namespace TheRouteSetter.Application.ConvexHull;

public sealed record ColliderGenerationResult(string ColliderAbsolutePath, bool WasRegenerated, string SourceHash);
