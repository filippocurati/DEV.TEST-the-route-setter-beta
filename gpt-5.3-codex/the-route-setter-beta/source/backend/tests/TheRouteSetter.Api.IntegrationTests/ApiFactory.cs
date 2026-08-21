using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace TheRouteSetter.Api.IntegrationTests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public string DataRootPath { get; } = Path.Combine(Path.GetTempPath(), "trs-api-" + Guid.NewGuid().ToString("N"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(DataRootPath);

        builder.ConfigureAppConfiguration((_, configurationBuilder) =>
        {
            string contentRoot = AppContext.BaseDirectory;
            string relativePath = Path.GetRelativePath(contentRoot, DataRootPath);

            configurationBuilder.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ApiData:RelativeDataPath"] = relativePath
                });
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (disposing && Directory.Exists(DataRootPath))
        {
            Directory.Delete(DataRootPath, true);
        }
    }
}
