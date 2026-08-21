namespace TheRouteSetter.Application.Assets;

public interface IAssetDiscoveryService
{
    Task<AssetCatalogSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default);

    Task<HoldAsset?> GetHoldByIdAsync(string holdId, CancellationToken cancellationToken = default);
}
