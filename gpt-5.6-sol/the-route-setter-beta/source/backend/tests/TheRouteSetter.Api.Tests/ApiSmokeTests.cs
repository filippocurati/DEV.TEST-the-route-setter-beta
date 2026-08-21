using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica che l'host API di base sia avviabile e documentato.
/// </summary>
public sealed class ApiSmokeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient client;

    /// <summary>
    /// Inizializza il client HTTP collegato all'host di test in memoria.
    /// </summary>
    /// <param name="factory">Factory ASP.NET Core condivisa dalla suite.</param>
    public ApiSmokeTests(WebApplicationFactory<Program> factory)
    {
        client = factory.CreateClient();
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
