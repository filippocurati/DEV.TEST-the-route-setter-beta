using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TheRouteSetter.Api.Services.Assets;

namespace TheRouteSetter.Api.Tests.Support;

/// <summary>Every test host, including smoke tests, uses temporary assets and logs.</summary>
public class IsolatedApiFactory : WebApplicationFactory<Program>
{
    private readonly bool ownsRoot;
    protected string IsolatedRoot { get; }

    public IsolatedApiFactory() : this(null) { }

    protected IsolatedApiFactory(string? root)
    {
        ownsRoot = root is null;
        IsolatedRoot = root ?? Path.Combine(Path.GetTempPath(), $"isolated-api-{Guid.NewGuid():N}");
        Directory.CreateDirectory(IsolatedRoot);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AssetStorage:RootPath"] = IsolatedRoot,
            ["Logging:FilePath"] = Path.Combine(IsolatedRoot, "test-logs", "log-.json")
        }));
        // Options are forced after all configuration sources, before any worker is constructed.
        builder.ConfigureServices(services => services.AddSingleton<IOptions<AssetStorageOptions>>(Options.Create(new AssetStorageOptions
        {
            RootPath = IsolatedRoot,
            MainWallDirectory = "main-wall",
            HoldsDirectory = "holds"
        })));
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        for (var attempt = 0; ownsRoot && Directory.Exists(IsolatedRoot); attempt++)
        {
            try { Directory.Delete(IsolatedRoot, true); }
            catch (IOException) when (attempt < 99) { await Task.Delay(20); }
        }
    }
}
