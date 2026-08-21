using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using TheRouteSetter.Api.Models;
using TheRouteSetter.Api.Tests.Support;
using Xunit;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica contratti HTTP, URL del manifest e download differito degli asset.
/// </summary>
public sealed class AssetApiIntegrationTests : IDisposable
{
    private readonly AssetTestData data = new();
    private readonly AssetApiFactory factory;
    private readonly HttpClient client;

    /// <summary>
    /// Avvia un host API configurato con asset temporanei.
    /// </summary>
    public AssetApiIntegrationTests()
    {
        factory = new AssetApiFactory(data.RootPath);
        client = factory.CreateClient();
    }

    /// <summary>
    /// Verifica che la parete sia servita come GLB.
    /// </summary>
    [Fact]
    public async Task WallEndpoint_ReturnsConfiguredGlb()
    {
        var response = await client.GetAsync("/api/wall");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("model/gltf-binary", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("WALL-BYTES", await response.Content.ReadAsStringAsync());
    }

    /// <summary>
    /// Verifica forma del manifest e assenza del contenuto dei modelli nella risposta.
    /// </summary>
    [Fact]
    public async Task HoldsEndpoint_ReturnsLightweightConsistentManifest()
    {
        var response = await client.GetAsync("/api/holds");
        var body = await response.Content.ReadAsStringAsync();
        var holds = JsonSerializer.Deserialize<HoldManifest[]>(body, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(holds);
        Assert.Equal(2, holds.Length);
        Assert.DoesNotContain("MODEL-ONE", body);
        Assert.DoesNotContain("hold1.glb", body, StringComparison.OrdinalIgnoreCase);
        Assert.All(holds, hold => Assert.StartsWith($"/api/holds/{hold.Id}/", hold.ModelUrl));
    }

    /// <summary>
    /// Verifica download modello, preview, collider e asset opzionale tramite gli URL dichiarati.
    /// </summary>
    [Fact]
    public async Task ManifestUrls_ResolveAvailableFiles()
    {
        var holds = await client.GetFromJsonAsync<HoldManifest[]>("/api/holds");
        var hold = Assert.Single(holds!, item => item.Id == "Hold1");

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(hold.ModelUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(hold.PreviewUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(hold.ColliderUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(Assert.Single(hold.OptionalAssetUrls))).StatusCode);
    }

    /// <summary>
    /// Verifica che file opzionali assenti non impediscano modello e catalogo.
    /// </summary>
    [Fact]
    public async Task HoldWithoutTexturePreviewOrCollider_RemainsLoadable()
    {
        var holds = await client.GetFromJsonAsync<HoldManifest[]>("/api/holds");
        var hold = Assert.Single(holds!, item => item.Id == "Hold2");

        Assert.Null(hold.PreviewUrl);
        Assert.Equal(ColliderAvailability.Missing, hold.ColliderStatus);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(hold.ModelUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/holds/Hold2/collider")).StatusCode);
    }

    /// <summary>
    /// Verifica che l'endpoint base di log accetti un evento JSON.
    /// </summary>
    [Fact]
    public async Task LogsEndpoint_AcceptsFrontendEvent()
    {
        var response = await client.PostAsJsonAsync(
            "/api/logs",
            new FrontendLogRequest(LogLevel.Warning, "AssetLoad", "Anteprima non disponibile", "Catalog"));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    }

    /// <summary>
    /// Verifica che livello None, messaggi fuori limite e contesto eccessivo siano rifiutati.
    /// </summary>
    [Fact]
    public async Task LogsEndpoint_RejectsInvalidPayloads()
    {
        var noneLevel = await client.PostAsJsonAsync(
            "/api/logs",
            new FrontendLogRequest(LogLevel.None, "UI", "Messaggio", "Catalog"));
        var longMessage = await client.PostAsJsonAsync(
            "/api/logs",
            new FrontendLogRequest(LogLevel.Error, "UI", new string('x', 2001), "Catalog"));
        var excessiveContext = Enumerable.Range(0, 21).ToDictionary(index => $"key{index}", index => $"value{index}");
        var tooMuchContext = await client.PostAsJsonAsync(
            "/api/logs",
            new FrontendLogRequest(LogLevel.Warning, "UI", "Messaggio", "Catalog", excessiveContext));

        Assert.Equal(HttpStatusCode.BadRequest, noneLevel.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, longMessage.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tooMuchContext.StatusCode);
    }

    /// <summary>
    /// Verifica che ogni risposta esponga lo stesso RequestId usato dalla pipeline di logging.
    /// </summary>
    [Fact]
    public async Task Response_ContainsRequestCorrelationHeader()
    {
        var response = await client.GetAsync("/api/system/health");

        Assert.True(response.Headers.TryGetValues("X-Request-Id", out var values));
        Assert.False(string.IsNullOrWhiteSpace(Assert.Single(values)));
    }

    /// <summary>
    /// Verifica che OpenAPI documenti tutti gli endpoint baseline obbligatori.
    /// </summary>
    [Fact]
    public async Task OpenApi_ContainsBaselineEndpoints()
    {
        using var document = JsonDocument.Parse(await client.GetStringAsync("/swagger/v1/swagger.json"));
        var paths = document.RootElement.GetProperty("paths");

        Assert.True(paths.TryGetProperty("/api/wall", out _));
        Assert.True(paths.TryGetProperty("/api/holds", out _));
        Assert.True(paths.TryGetProperty("/api/holds/{id}/model", out _));
        Assert.True(paths.TryGetProperty("/api/holds/{id}/collider", out _));
        Assert.True(paths.TryGetProperty("/api/logs", out _));
    }

    /// <summary>
    /// Rilascia client, host e cartella temporanea.
    /// </summary>
    public void Dispose()
    {
        client.Dispose();
        factory.Dispose();
        data.Dispose();
    }
}
