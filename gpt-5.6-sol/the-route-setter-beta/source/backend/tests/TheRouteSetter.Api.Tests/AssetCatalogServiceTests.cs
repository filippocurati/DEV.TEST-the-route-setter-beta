using Microsoft.Extensions.Options;
using TheRouteSetter.Api.Models;
using TheRouteSetter.Api.Services.Assets;
using TheRouteSetter.Api.Tests.Support;
using Xunit;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica la discovery file system indipendentemente dal livello HTTP.
/// </summary>
public sealed class AssetCatalogServiceTests : IDisposable
{
    private readonly AssetTestData data = new();
    private readonly FileSystemAssetCatalogService service;

    /// <summary>
    /// Inizializza il servizio sulla gerarchia temporanea.
    /// </summary>
    public AssetCatalogServiceTests()
    {
        service = new FileSystemAssetCatalogService(
            Options.Create(new AssetStorageOptions
            {
                RootPath = data.RootPath,
                MainWallDirectory = "main-wall",
                HoldsDirectory = "holds"
            }),
            new TestWebHostEnvironment { ContentRootPath = data.RootPath },
            new TestColliderJobStore());
    }

    /// <summary>
    /// Verifica naming, ordinamento e scarto delle cartelle prive di GLB.
    /// </summary>
    [Fact]
    public void GetHolds_ReturnsOnlyValidHoldDirectoriesWithModels()
    {
        var holds = service.GetHolds();

        Assert.Collection(
            holds,
            hold => Assert.Equal("Hold1", hold.Id),
            hold => Assert.Equal("Hold2", hold.Id));
    }

    /// <summary>
    /// Verifica che preview, collider e asset opzionali siano rilevati senza leggere il GLB.
    /// </summary>
    [Fact]
    public void GetHolds_DescribesAvailableAndMissingOptionalFiles()
    {
        var holds = service.GetHolds();

        var complete = holds[0];
        Assert.Equal("/api/holds/Hold1/preview", complete.PreviewUrl);
        Assert.Equal("/api/holds/Hold1/model", complete.ModelUrl);
        Assert.Equal("/api/holds/Hold1/collider", complete.ColliderUrl);
        Assert.Equal(ColliderAvailability.Ready, complete.ColliderStatus);
        Assert.Equal(["/api/holds/Hold1/assets/material.bin"], complete.OptionalAssetUrls);

        var modelOnly = holds[1];
        Assert.Null(modelOnly.PreviewUrl);
        Assert.Null(modelOnly.ColliderUrl);
        Assert.Equal(ColliderAvailability.Missing, modelOnly.ColliderStatus);
        Assert.Empty(modelOnly.OptionalAssetUrls);
    }

    /// <summary>
    /// Verifica che l'accesso non consenta ID o nomi file esterni alla discovery.
    /// </summary>
    [Fact]
    public void AssetAccess_RejectsInvalidIdentifiersAndTraversal()
    {
        Assert.Null(service.GetHoldModel("hold4"));
        Assert.Null(service.GetHoldModel("../Hold1"));
        Assert.Null(service.GetHoldOptionalAsset("Hold1", "../wall.glb"));
        Assert.Null(service.GetHoldOptionalAsset("Hold1", "hold1.glb"));
    }

    /// <summary>
    /// Elimina la gerarchia temporanea al termine di ogni test.
    /// </summary>
    public void Dispose() => data.Dispose();
}
