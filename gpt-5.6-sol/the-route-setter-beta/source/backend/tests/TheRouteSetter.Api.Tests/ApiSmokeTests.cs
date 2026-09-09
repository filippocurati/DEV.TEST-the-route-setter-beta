using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;
using TheRouteSetter.Api.Tests.Support;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TheRouteSetter.Api.Services.Assets;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica che l'host API di base sia avviabile e documentato.
/// </summary>
public sealed class ApiSmokeTests : IClassFixture<IsolatedApiFactory>
{
    private readonly HttpClient client;

    /// <summary>
    /// Inizializza il client HTTP collegato all'host di test in memoria.
    /// </summary>
    /// <param name="factory">Factory ASP.NET Core condivisa dalla suite.</param>
    public ApiSmokeTests(IsolatedApiFactory factory)
    {
        client = factory.CreateClient();
        var root = factory.Services.GetRequiredService<IOptions<AssetStorageOptions>>().Value.RootPath;
        Assert.StartsWith(Path.GetTempPath(), root, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Verifica che il documento OpenAPI sia raggiungibile.
    /// </summary>
    [Fact]
    public async Task SwaggerDocument_IsAvailable()
    {
        var response = await client.GetAsync("/swagger/v1/swagger.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>
    /// Verifica che l'endpoint di disponibilita risponda correttamente.
    /// </summary>
    [Fact]
    public async Task HealthEndpoint_ReturnsHealthyStatus()
    {
        var response = await client.GetAsync("/api/system/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("Healthy", await response.Content.ReadAsStringAsync());
    }
}
