using System.Text.RegularExpressions;
using TheRouteSetter.Application.ConvexHull;

namespace TheRouteSetter.Application.Assets;

public sealed class AssetDiscoveryService : IAssetDiscoveryService
{
    private static readonly Regex HoldFolderRegex = new("^Hold[0-9]+$", RegexOptions.Compiled);

    private readonly AssetDiscoveryOptions options;
    private readonly IColliderGenerationService colliderGenerationService;

    public AssetDiscoveryService(AssetDiscoveryOptions options, IColliderGenerationService colliderGenerationService)
    {
        this.options = options;
        this.colliderGenerationService = colliderGenerationService;
    }

    public async Task<AssetCatalogSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        WallAsset? wall = DiscoverWallAsset();
        IReadOnlyList<HoldAsset> holds = await DiscoverHoldAssetsAsync(cancellationToken);

        return new AssetCatalogSnapshot(wall, holds);
    }

    public async Task<HoldAsset?> GetHoldByIdAsync(string holdId, CancellationToken cancellationToken = default)
    {
        AssetCatalogSnapshot snapshot = await GetSnapshotAsync(cancellationToken);
        return snapshot.Holds.FirstOrDefault(hold => hold.Id.Equals(holdId, StringComparison.OrdinalIgnoreCase));
    }

    private WallAsset? DiscoverWallAsset()
    {
        string wallDirectory = Path.Combine(options.DataRootPath, options.MainWallFolderName);
        if (!Directory.Exists(wallDirectory))
        {
            return null;
        }

        string? wallModelPath = Directory
            .EnumerateFiles(wallDirectory, "*.glb", SearchOption.TopDirectoryOnly)
            .OrderBy(static filePath => filePath, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault();

        if (wallModelPath is null)
        {
            return null;
        }

        return new WallAsset(ToRelativeDataPath(wallModelPath), wallModelPath);
    }

    private async Task<IReadOnlyList<HoldAsset>> DiscoverHoldAssetsAsync(CancellationToken cancellationToken)
    {
        string holdsDirectory = Path.Combine(options.DataRootPath, options.HoldsFolderName);
        if (!Directory.Exists(holdsDirectory))
        {
            return Array.Empty<HoldAsset>();
        }

        List<HoldAsset> discoveredHolds = new();

        foreach (string holdDirectory in Directory.EnumerateDirectories(holdsDirectory, "*", SearchOption.TopDirectoryOnly))
        {
            string holdFolderName = Path.GetFileName(holdDirectory);
            if (!HoldFolderRegex.IsMatch(holdFolderName))
            {
                continue;
            }

            string? modelPath = Directory
                .EnumerateFiles(holdDirectory, "*.glb", SearchOption.TopDirectoryOnly)
                .OrderBy(static filePath => filePath, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();

            if (modelPath is null)
            {
                continue;
            }

            string? previewPath = Directory
                .EnumerateFiles(holdDirectory, "PREV_*", SearchOption.TopDirectoryOnly)
                .OrderBy(static filePath => filePath, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();

            string colliderPath = Path.Combine(holdDirectory, options.ColliderFileName);
            bool isColliderReady = await colliderGenerationService.IsColliderCoherentAsync(modelPath, colliderPath, cancellationToken);

            discoveredHolds.Add(
                new HoldAsset(
                    holdFolderName,
                    holdFolderName,
                    ToRelativeDataPath(modelPath),
                    modelPath,
                    previewPath is null ? null : ToRelativeDataPath(previewPath),
                    colliderPath,
                    isColliderReady ? ToRelativeDataPath(colliderPath) : null,
                    isColliderReady));
        }

        return discoveredHolds
            .OrderBy(static hold => hold.Id, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private string ToRelativeDataPath(string absolutePath)
    {
        string relativePath = Path.GetRelativePath(options.DataRootPath, absolutePath);
        return relativePath.Replace('\\', '/');
    }
}
