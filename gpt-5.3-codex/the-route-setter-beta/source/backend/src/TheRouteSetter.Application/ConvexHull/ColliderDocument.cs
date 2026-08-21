namespace TheRouteSetter.Application.ConvexHull;

public sealed record ColliderDocument(string SourceHash, IReadOnlyList<double> Vertices, IReadOnlyList<int>? Indices);
