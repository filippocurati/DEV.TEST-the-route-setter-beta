using TheRouteSetter.Application.Assets;
using TheRouteSetter.Api.Contracts;

namespace TheRouteSetter.Api.Services;

public sealed class AssetManifestService
{
    private readonly IAssetDiscoveryService assetDiscoveryService;

    public AssetManifestService(IAssetDiscoveryService assetDiscoveryService)
    {
        this.assetDiscoveryService = assetDiscoveryService;
    }

    public async Task<WallResponseDto?> GetWallAsync(CancellationToken cancellationToken = default)
    {
        AssetCatalogSnapshot snapshot = await assetDiscoveryService.GetSnapshotAsync(cancellationToken);
        if (snapshot.Wall is null)
        {
            return null;
        }

        return new WallResponseDto(BuildDataUrl(snapshot.Wall.RelativeModelPath));
    }

    public async Task<IReadOnlyList<HoldManifestDto>> GetHoldsAsync(CancellationToken cancellationToken = default)
    {
        AssetCatalogSnapshot snapshot = await assetDiscoveryService.GetSnapshotAsync(cancellationToken);
        return snapshot.Holds
            .Select(MapHold)
            .ToArray();
    }

    public async Task<HoldManifestDto?> GetHoldAsync(string holdId, CancellationToken cancellationToken = default)
    {
        HoldAsset? hold = await assetDiscoveryService.GetHoldByIdAsync(holdId, cancellationToken);
        return hold is null ? null : MapHold(hold);
    }

    public async Task<string?> GetHoldModelUrlAsync(string holdId, CancellationToken cancellationToken = default)
    {
        HoldAsset? hold = await assetDiscoveryService.GetHoldByIdAsync(holdId, cancellationToken);
        return hold is null ? null : BuildDataUrl(hold.RelativeModelPath);
    }

    public async Task<string?> GetHoldColliderUrlAsync(string holdId, CancellationToken cancellationToken = default)
    {
        HoldAsset? hold = await assetDiscoveryService.GetHoldByIdAsync(holdId, cancellationToken);
        if (hold is null || !hold.IsColliderReady || hold.RelativeColliderPath is null)
        {
            return null;
        }

        return BuildDataUrl(hold.RelativeColliderPath);
    }

    private static HoldManifestDto MapHold(HoldAsset hold)
    {
        return new HoldManifestDto(
            hold.Id,
            hold.RelativePreviewPath is null ? null : BuildDataUrl(hold.RelativePreviewPath),
            BuildDataUrl(hold.RelativeModelPath),
            hold.RelativeColliderPath is null ? null : BuildDataUrl(hold.RelativeColliderPath),
            hold.IsColliderReady);
    }

    private static string BuildDataUrl(string relativePath)
    {
        return $"/data/{relativePath}";
    }
}
