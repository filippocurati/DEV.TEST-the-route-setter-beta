namespace TheRouteSetter.Api.Contracts;

public sealed record HoldManifestDto(
    string Id,
    string? PreviewUrl,
    string ModelUrl,
    string? ColliderUrl,
    bool ColliderReady);
