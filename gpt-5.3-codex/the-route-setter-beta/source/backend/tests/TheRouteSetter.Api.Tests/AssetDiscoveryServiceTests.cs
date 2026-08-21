using TheRouteSetter.Application.Assets;
using TheRouteSetter.Application.ConvexHull;
using System.Security.Cryptography;
using System.Text.Json;

namespace TheRouteSetter.Api.Tests;

public sealed class AssetDiscoveryServiceTests : IDisposable
{
    private readonly string tempDirectory;

    public AssetDiscoveryServiceTests()
    {
        tempDirectory = Path.Combine(Path.GetTempPath(), "trs-assets-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDirectory);
    }

    [Fact]
    public async Task DiscoversOnlyHoldNumberFoldersAndIgnoresMissingGlb()
    {
        string dataRoot = Path.Combine(tempDirectory, "Data");
        string mainWall = Path.Combine(dataRoot, "main-wall");
        string holds = Path.Combine(dataRoot, "holds");
        Directory.CreateDirectory(mainWall);
        Directory.CreateDirectory(holds);

        await File.WriteAllBytesAsync(Path.Combine(mainWall, "wall.glb"), [0x01]);

        string validHold = Path.Combine(holds, "Hold1");
        Directory.CreateDirectory(validHold);
        await File.WriteAllBytesAsync(Path.Combine(validHold, "hold1.glb"), [0x02]);
        await File.WriteAllBytesAsync(Path.Combine(validHold, "PREV_hold1.png"), [0x03]);

        string missingGlb = Path.Combine(holds, "Hold2");
        Directory.CreateDirectory(missingGlb);
        await File.WriteAllTextAsync(Path.Combine(missingGlb, "PREV_hold2.png"), "x");

        string invalidName = Path.Combine(holds, "HoldX");
        Directory.CreateDirectory(invalidName);
        await File.WriteAllBytesAsync(Path.Combine(invalidName, "holdx.glb"), [0x04]);

        var service = new AssetDiscoveryService(
            new AssetDiscoveryOptions
            {
                DataRootPath = dataRoot
            },
            new ColliderGenerationService());

        AssetCatalogSnapshot snapshot = await service.GetSnapshotAsync();

        Assert.NotNull(snapshot.Wall);
        Assert.Equal("main-wall/wall.glb", snapshot.Wall!.RelativeModelPath);
        Assert.Single(snapshot.Holds);

        HoldAsset hold = snapshot.Holds[0];
        Assert.Equal("Hold1", hold.Id);
        Assert.Equal("holds/Hold1/hold1.glb", hold.RelativeModelPath);
        Assert.Equal("holds/Hold1/PREV_hold1.png", hold.RelativePreviewPath);
        Assert.False(hold.IsColliderReady);
        Assert.Null(hold.RelativeColliderPath);
    }

    [Fact]
    public async Task MarksColliderAsReadyOnlyWhenHashMatches()
    {
        string dataRoot = Path.Combine(tempDirectory, "Data");
        string holds = Path.Combine(dataRoot, "holds");
        Directory.CreateDirectory(Path.Combine(dataRoot, "main-wall"));
        Directory.CreateDirectory(holds);

        string holdPath = Path.Combine(holds, "Hold10");
        Directory.CreateDirectory(holdPath);
        string modelPath = Path.Combine(holdPath, "hold10.glb");
        string colliderPath = Path.Combine(holdPath, "collider.json");
        byte[] modelBytes = [0x11, 0x22, 0x33, 0x44];
        await File.WriteAllBytesAsync(modelPath, modelBytes);

        string sourceHash = "sha256:" + Convert.ToHexString(SHA256.HashData(modelBytes)).ToLowerInvariant();
        ColliderDocument coherentDocument = new(sourceHash, [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 1, 2]);
        await File.WriteAllTextAsync(colliderPath, JsonSerializer.Serialize(coherentDocument, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        }));

        IColliderGenerationService colliderService = new ColliderGenerationService();

        var service = new AssetDiscoveryService(
            new AssetDiscoveryOptions
            {
                DataRootPath = dataRoot
            },
            colliderService);

        HoldAsset? hold = await service.GetHoldByIdAsync("Hold10");

        Assert.NotNull(hold);
        Assert.True(hold!.IsColliderReady);
        Assert.Equal("holds/Hold10/collider.json", hold.RelativeColliderPath);
    }

    [Fact]
    public async Task MarksColliderAsNotReadyWhenHashIsNotCoherent()
    {
        string dataRoot = Path.Combine(tempDirectory, "Data");
        string holds = Path.Combine(dataRoot, "holds");
        Directory.CreateDirectory(Path.Combine(dataRoot, "main-wall"));
        Directory.CreateDirectory(holds);

        string holdPath = Path.Combine(holds, "Hold11");
        Directory.CreateDirectory(holdPath);
        string modelPath = Path.Combine(holdPath, "hold11.glb");
        string colliderPath = Path.Combine(holdPath, "collider.json");

        byte[] modelBytes = [0x01, 0x02, 0x03];
        await File.WriteAllBytesAsync(modelPath, modelBytes);
        await File.WriteAllTextAsync(colliderPath, "{\"sourceHash\":\"sha256:invalid\",\"vertices\":[0,0,0,1,0,0,0,1,0,0,0,1]}\"");

        var service = new AssetDiscoveryService(
            new AssetDiscoveryOptions
            {
                DataRootPath = dataRoot
            },
            new ColliderGenerationService());

        HoldAsset? hold = await service.GetHoldByIdAsync("Hold11");

        Assert.NotNull(hold);
        Assert.False(hold!.IsColliderReady);
        Assert.Null(hold.RelativeColliderPath);
    }

    public void Dispose()
    {
        if (Directory.Exists(tempDirectory))
        {
            Directory.Delete(tempDirectory, true);
        }
    }
}
