using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;
using Moq;
using TheRouteSetter.Backend.Services.Catalog;
using TheRouteSetter.Backend.Services.Wall;
using TheRouteSetter.Backend.Models;

namespace TheRouteSetter.Backend.Tests;

public class DiscoveryTests : IDisposable
{
    private readonly string _testDataRoot;
    private readonly IConfiguration _configuration;
    private readonly Mock<IWebHostEnvironment> _envMock;

    public DiscoveryTests()
    {
        _testDataRoot = Path.Combine(Path.GetTempPath(), "RouteSetterTest_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(_testDataRoot, "main-wall"));
        Directory.CreateDirectory(Path.Combine(_testDataRoot, "holds", "Hold1"));
        Directory.CreateDirectory(Path.Combine(_testDataRoot, "holds", "Hold2"));

        var data = new Dictionary<string, string?>
        {
            ["DataPaths:Root"] = _testDataRoot
        };
        _configuration = new ConfigurationBuilder().AddInMemoryCollection(data).Build();
        _envMock = new Mock<IWebHostEnvironment>();
    }

    public void Dispose()
    {
        try { Directory.Delete(_testDataRoot, true); } catch { }
    }

    private HoldDiscoveryService CreateHoldService(IConfiguration? config = null)
    {
        return new HoldDiscoveryService(
            config ?? _configuration,
            _envMock.Object,
            Mock.Of<ILogger<HoldDiscoveryService>>());
    }

    private WallService CreateWallService(IConfiguration? config = null)
    {
        return new WallService(
            config ?? _configuration,
            _envMock.Object,
            Mock.Of<ILogger<WallService>>());
    }

    [Fact]
    public void DiscoverHolds_NoHoldsDirectory_ReturnsEmptyList()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DataPaths:Root"] = Path.Combine(Path.GetTempPath(), "nonexistent_" + Guid.NewGuid())
        }).Build();

        var service = CreateHoldService(config);
        var result = service.DiscoverHolds();
        Assert.Empty(result);
    }

    [Fact]
    public void DiscoverHolds_WithTwoHolds_ReturnsBoth()
    {
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold1", "hold1.glb"), "dummy");
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold2", "hold2.glb"), "dummy");

        var service = CreateHoldService();
        var result = service.DiscoverHolds();
        Assert.Equal(2, result.Count);
        Assert.Contains(result, h => h.Id == "Hold1");
        Assert.Contains(result, h => h.Id == "Hold2");
    }

    [Fact]
    public void DiscoverHolds_IgnoresNonHoldDirectories()
    {
        Directory.CreateDirectory(Path.Combine(_testDataRoot, "holds", "not_a_hold"));
        Directory.CreateDirectory(Path.Combine(_testDataRoot, "holds", "RandomFolder"));
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold1", "hold1.glb"), "dummy");

        var service = CreateHoldService();
        var result = service.DiscoverHolds();
        Assert.Single(result);
        Assert.Equal("Hold1", result[0].Id);
    }

    [Fact]
    public void DiscoverHolds_SkipsHoldWithoutGLB()
    {
        Directory.CreateDirectory(Path.Combine(_testDataRoot, "holds", "Hold3"));
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold1", "hold1.glb"), "dummy");

        var service = CreateHoldService();
        var result = service.DiscoverHolds();
        Assert.Single(result);
        Assert.Equal("Hold1", result[0].Id);
    }

    [Fact]
    public void DiscoverHolds_DetectsPreviewAndCollider()
    {
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold1", "hold1.glb"), "dummy");
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold1", "PREV_hold1.png"), "dummy");
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold2", "hold2.glb"), "dummy");

        var service = CreateHoldService();
        var result = service.DiscoverHolds();

        var hold1 = result.First(h => h.Id == "Hold1");
        Assert.NotEmpty(hold1.PreviewUrl);
        Assert.False(hold1.ColliderReady);
        Assert.Empty(hold1.ColliderUrl);

        var hold2 = result.First(h => h.Id == "Hold2");
        Assert.Empty(hold2.PreviewUrl);
    }

    [Fact]
    public void DiscoverHolds_DetectsColliderReady()
    {
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold1", "hold1.glb"), "dummy");
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold1", "collider.json"), "{}");
        File.WriteAllText(Path.Combine(_testDataRoot, "holds", "Hold2", "hold2.glb"), "dummy");

        var service = CreateHoldService();
        var result = service.DiscoverHolds();

        var hold1 = result.First(h => h.Id == "Hold1");
        Assert.True(hold1.ColliderReady);
        Assert.NotEmpty(hold1.ColliderUrl);

        var hold2 = result.First(h => h.Id == "Hold2");
        Assert.False(hold2.ColliderReady);
        Assert.Empty(hold2.ColliderUrl);
    }

    [Fact]
    public void WallInfo_ReturnsCorrectModelUrl()
    {
        File.WriteAllText(Path.Combine(_testDataRoot, "main-wall", "modello_parete.glb"), "dummy");

        var service = CreateWallService();
        var result = service.GetWallInfo();

        Assert.Equal("main-wall", result.Id);
        Assert.Equal("Parete principale", result.Name);
        Assert.Contains("/static/main-wall/modello_parete.glb", result.ModelUrl);
    }

    [Fact]
    public void WallInfo_NoWallDirectory_ReturnsDefault()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DataPaths:Root"] = Path.Combine(Path.GetTempPath(), "nonexistent_" + Guid.NewGuid())
        }).Build();

        var service = CreateWallService(config);
        var result = service.GetWallInfo();

        Assert.Equal("main-wall", result.Id);
        Assert.Empty(result.ModelUrl);
    }
}