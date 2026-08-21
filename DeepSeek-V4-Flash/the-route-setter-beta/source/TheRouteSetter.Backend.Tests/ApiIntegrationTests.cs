using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using TheRouteSetter.Backend.Models;

namespace TheRouteSetter.Backend.Tests;

public class ApiIntegrationTests : IDisposable
{
    private readonly string _testDataRoot;
    private readonly HttpClient _client;

    public ApiIntegrationTests()
    {
        _testDataRoot = Path.Combine(Path.GetTempPath(), "RouteSetterIntTest_" + Guid.NewGuid().ToString("N"));

        // Crea struttura dati di test — dentro Data/ come da default appsettings
        var dataDir = Path.Combine(_testDataRoot, "Data");
        Directory.CreateDirectory(Path.Combine(dataDir, "main-wall"));
        File.WriteAllText(Path.Combine(dataDir, "main-wall", "modello_parete.glb"), "dummy-wall-data");

        Directory.CreateDirectory(Path.Combine(dataDir, "holds", "Hold1"));
        File.WriteAllText(Path.Combine(dataDir, "holds", "Hold1", "hold1.glb"), "dummy-hold1");
        File.WriteAllText(Path.Combine(dataDir, "holds", "Hold1", "PREV_hold1.png"), "dummy-preview");

        Directory.CreateDirectory(Path.Combine(dataDir, "holds", "Hold2"));
        File.WriteAllText(Path.Combine(dataDir, "holds", "Hold2", "hold2.glb"), "dummy-hold2");
        File.WriteAllText(Path.Combine(dataDir, "holds", "Hold2", "PREV_hold2.png"), "dummy-preview");
        File.WriteAllText(Path.Combine(dataDir, "holds", "Hold2", "collider.json"), "{\"sourceHash\":\"abc\",\"vertices\":[]}");

        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting(WebHostDefaults.ContentRootKey, _testDataRoot);
        });

        _client = factory.CreateClient();
    }

    public void Dispose()
    {
        try { Directory.Delete(_testDataRoot, true); } catch { }
    }

    [Fact]
    public async Task GetWall_ReturnsOkWithWallInfo()
    {
        var response = await _client.GetAsync("/api/wall");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<WallInfo>();
        Assert.NotNull(content);
        Assert.Equal("main-wall", content!.Id);
    }

    [Fact]
    public async Task GetHolds_ReturnsOkWithHoldsList()
    {
        var response = await _client.GetAsync("/api/holds");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<List<HoldManifest>>();
        Assert.NotNull(content);
        Assert.NotEmpty(content);
    }

    [Fact]
    public async Task GetHolds_HoldManifestHasRequiredFields()
    {
        var response = await _client.GetAsync("/api/holds");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<List<HoldManifest>>();
        Assert.NotNull(content);

        foreach (var hold in content!)
        {
            Assert.False(string.IsNullOrEmpty(hold.Id));
            Assert.Matches(@"^Hold\d+$", hold.Id);
            Assert.False(string.IsNullOrEmpty(hold.ModelUrl));
        }
    }

    [Fact]
    public async Task GetHolds_CorrectlyReportsColliderStatus()
    {
        var response = await _client.GetAsync("/api/holds");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<List<HoldManifest>>();
        Assert.NotNull(content);

        var hold1 = content!.First(h => h.Id == "Hold1");
        Assert.NotEmpty(hold1.PreviewUrl);
        Assert.False(hold1.ColliderReady);
        Assert.Empty(hold1.ColliderUrl);

        var hold2 = content!.First(h => h.Id == "Hold2");
        Assert.True(hold2.ColliderReady);
        Assert.NotEmpty(hold2.ColliderUrl);
    }

    [Fact]
    public async Task GetHoldModel_NonExistingHold_ReturnsNotFound()
    {
        var response = await _client.GetAsync("/api/holds/NonExistentHold/model");
        Assert.Equal(System.Net.HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetHoldCollider_NonExistingHold_ReturnsNotFound()
    {
        var response = await _client.GetAsync("/api/holds/NonExistentHold/collider");
        Assert.Equal(System.Net.HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostLog_ValidEntry_ReturnsOk()
    {
        var entry = new LogEntry
        {
            Level = "Information",
            Category = "UI",
            Message = "Test log entry",
            Component = "ApiIntegrationTests"
        };

        var response = await _client.PostAsJsonAsync("/api/logs", entry);
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task PostLog_EmptyMessage_ReturnsBadRequest()
    {
        var entry = new LogEntry
        {
            Level = "Information",
            Category = "UI",
            Message = "",
            Component = "ApiIntegrationTests"
        };

        var response = await _client.PostAsJsonAsync("/api/logs", entry);
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }
}