using TheRouteSetter.Api.Contracts;
using System.Security.Cryptography;
using System.Text.Json;

namespace TheRouteSetter.Api.IntegrationTests;

public sealed class BaselineEndpointsTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;
    private readonly HttpClient httpClient;

    public BaselineEndpointsTests(ApiFactory factory)
    {
        this.factory = factory;
        httpClient = factory.CreateClient();
    }

    [Fact]
    public async Task ReturnsManifestAndUrlsForConfiguredAssets()
    {
        PrepareAssets(factory.DataRootPath, withCollider: true, withPreview: true);

        HttpResponseMessage wallResponse = await httpClient.GetAsync("/api/wall");
        Assert.Equal(HttpStatusCode.OK, wallResponse.StatusCode);

        WallResponseDto? wall = await wallResponse.Content.ReadFromJsonAsync<WallResponseDto>();
        Assert.NotNull(wall);
        Assert.Equal("/data/main-wall/modello_parete.glb", wall!.ModelUrl);

        HttpResponseMessage holdsResponse = await httpClient.GetAsync("/api/holds");
        Assert.Equal(HttpStatusCode.OK, holdsResponse.StatusCode);

        IReadOnlyList<HoldManifestDto>? holds = await holdsResponse.Content.ReadFromJsonAsync<IReadOnlyList<HoldManifestDto>>();
        Assert.NotNull(holds);
        Assert.Single(holds!);

        HoldManifestDto hold = holds[0];
        Assert.Equal("Hold1", hold.Id);
        Assert.Equal("/data/holds/Hold1/hold1.glb", hold.ModelUrl);
        Assert.Equal("/data/holds/Hold1/PREV_hold1.png", hold.PreviewUrl);
        Assert.Equal("/data/holds/Hold1/collider.json", hold.ColliderUrl);
        Assert.True(hold.ColliderReady);

        HttpResponseMessage modelResponse = await httpClient.GetAsync("/api/holds/Hold1/model");
        Assert.Equal(HttpStatusCode.OK, modelResponse.StatusCode);
        AssetFileUrlDto? model = await modelResponse.Content.ReadFromJsonAsync<AssetFileUrlDto>();
        Assert.NotNull(model);
        Assert.Equal("/data/holds/Hold1/hold1.glb", model!.Url);

        HttpResponseMessage modelFileResponse = await httpClient.GetAsync(model.Url);
        Assert.Equal(HttpStatusCode.OK, modelFileResponse.StatusCode);

        HttpResponseMessage colliderResponse = await httpClient.GetAsync("/api/holds/Hold1/collider");
        Assert.Equal(HttpStatusCode.OK, colliderResponse.StatusCode);
        AssetFileUrlDto? collider = await colliderResponse.Content.ReadFromJsonAsync<AssetFileUrlDto>();
        Assert.NotNull(collider);
        Assert.Equal("/data/holds/Hold1/collider.json", collider!.Url);

        HttpResponseMessage colliderFileResponse = await httpClient.GetAsync(collider.Url);
        Assert.Equal(HttpStatusCode.OK, colliderFileResponse.StatusCode);
    }

    [Fact]
    public async Task KeepsHoldWithoutPreviewAndTextureAvailable()
    {
        PrepareAssets(factory.DataRootPath, withCollider: false, withPreview: false);

        HttpResponseMessage holdsResponse = await httpClient.GetAsync("/api/holds");
        Assert.Equal(HttpStatusCode.OK, holdsResponse.StatusCode);

        IReadOnlyList<HoldManifestDto>? holds = await holdsResponse.Content.ReadFromJsonAsync<IReadOnlyList<HoldManifestDto>>();
        Assert.NotNull(holds);
        Assert.Single(holds!);

        HoldManifestDto hold = holds[0];
        Assert.Null(hold.PreviewUrl);
        Assert.Equal("/data/holds/Hold1/hold1.glb", hold.ModelUrl);
    }

    [Fact]
    public async Task ReturnsAcceptedFromFrontendLogsEndpoint()
    {
        var payload = new FrontendLogRequestDto(
            "Error",
            "frontend.runtime",
            "Errore simulato",
            new Dictionary<string, string> { ["operation"] = "phase1-test" });

        HttpResponseMessage response = await httpClient.PostAsJsonAsync("/api/logs", payload);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        FrontendLogResponseDto? body = await response.Content.ReadFromJsonAsync<FrontendLogResponseDto>();
        Assert.NotNull(body);
        Assert.Equal("accepted", body!.Status);
        Assert.False(string.IsNullOrWhiteSpace(body.LogId));
    }

    private static void PrepareAssets(string dataRootPath, bool withCollider, bool withPreview)
    {
        if (Directory.Exists(dataRootPath))
        {
            Directory.Delete(dataRootPath, true);
        }

        string wallFolder = Path.Combine(dataRootPath, "main-wall");
        string holdsFolder = Path.Combine(dataRootPath, "holds");
        string holdFolder = Path.Combine(holdsFolder, "Hold1");
        string ignoredHoldFolder = Path.Combine(holdsFolder, "RandomFolder");

        Directory.CreateDirectory(wallFolder);
        Directory.CreateDirectory(holdFolder);
        Directory.CreateDirectory(ignoredHoldFolder);

        File.WriteAllBytes(Path.Combine(wallFolder, "modello_parete.glb"), [0x01]);
        byte[] holdModel = [0x02, 0x03, 0x04, 0x05];
        File.WriteAllBytes(Path.Combine(holdFolder, "hold1.glb"), holdModel);
        File.WriteAllBytes(Path.Combine(ignoredHoldFolder, "ignored.glb"), [0x03]);

        if (withPreview)
        {
            File.WriteAllBytes(Path.Combine(holdFolder, "PREV_hold1.png"), [0x04]);
        }

        if (withCollider)
        {
            string sourceHash = "sha256:" + Convert.ToHexString(SHA256.HashData(holdModel)).ToLowerInvariant();
            var colliderDocument = new
            {
                sourceHash,
                vertices = new[] { 0d, 0d, 0d, 1d, 0d, 0d, 0d, 1d, 0d, 0d, 0d, 1d },
                indices = new[] { 0, 1, 2 }
            };

            File.WriteAllText(
                Path.Combine(holdFolder, "collider.json"),
                JsonSerializer.Serialize(colliderDocument));
        }
    }
}
