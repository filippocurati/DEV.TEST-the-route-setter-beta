namespace TheRouteSetter.Application.Assets;

public sealed record WallAsset(string RelativeModelPath, string AbsoluteModelPath);

public sealed record HoldAsset(
    string Id,
    string FolderName,
    string RelativeModelPath,
    string AbsoluteModelPath,
    string? RelativePreviewPath,
    string AbsoluteColliderPath,
    string? RelativeColliderPath,
    bool IsColliderReady);

public sealed record AssetCatalogSnapshot(WallAsset? Wall, IReadOnlyList<HoldAsset> Holds);
