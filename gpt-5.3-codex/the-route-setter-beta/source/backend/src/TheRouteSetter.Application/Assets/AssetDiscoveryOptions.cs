namespace TheRouteSetter.Application.Assets;

public sealed class AssetDiscoveryOptions
{
    public required string DataRootPath { get; init; }

    public string MainWallFolderName { get; init; } = "main-wall";

    public string HoldsFolderName { get; init; } = "holds";

    public string ColliderFileName { get; init; } = "collider.json";
}
