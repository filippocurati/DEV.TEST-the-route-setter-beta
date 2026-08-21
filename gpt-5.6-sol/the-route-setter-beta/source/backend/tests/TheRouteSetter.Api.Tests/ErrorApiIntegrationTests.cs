using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TheRouteSetter.Api.Models;
using Xunit;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica il contratto HTTP reale del middleware globale senza endpoint diagnostici di produzione.
/// </summary>
public sealed class ErrorApiIntegrationTests : IDisposable
{
    private readonly string rootPath = Path.Combine(Path.GetTempPath(), $"error-api-{Guid.NewGuid():N}");
    private readonly ErrorApiFactory factory;
    private readonly HttpClient client;

    /// <summary>
    /// Avvia una pipeline di test che genera un errore dopo i middleware globali.
    /// </summary>
    public ErrorApiIntegrationTests()
    {
        Directory.CreateDirectory(rootPath);
        factory = new ErrorApiFactory(rootPath);
        client = factory.CreateClient();
    }

    /// <summary>
    /// Verifica status, ErrorId, RequestId e assenza di dettagli tecnici nella risposta.
    /// </summary>
    [Fact]
    public async Task UnhandledError_ReturnsSafeContractAndCorrelationHeader()
    {
        var response = await client.GetAsync("/test-error");
        var body = await response.Content.ReadAsStringAsync();
        var error = await response.Content.ReadFromJsonAsync<ErrorResponse>();

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.NotNull(error);
        Assert.True(response.Headers.TryGetValues("X-Request-Id", out var requestIds));
        Assert.Equal(error.RequestId, Assert.Single(requestIds));
        Assert.Matches("^[a-f0-9]{32}$", error.ErrorId);
        Assert.DoesNotContain("server-secret", body);
        Assert.DoesNotContain("C:\\internal", body);
        Assert.DoesNotContain("InvalidOperationException", body);
    }

    /// <summary>
    /// Rilascia host e directory temporanea.
    /// </summary>
    public void Dispose()
    {
        client.Dispose();
        factory.Dispose();
        for (var attempt = 0; attempt < 20 && Directory.Exists(rootPath); attempt++)
        {
            try
            {
                Directory.Delete(rootPath, recursive: true);
            }
            catch (IOException) when (attempt < 19)
            {
                Thread.Sleep(50);
            }
        }
    }

    /// <summary>
    /// Inserisce un ramo terminale di test dopo i middleware registrati dall'applicazione.
    /// </summary>
    private sealed class ErrorApiFactory : WebApplicationFactory<Program>
    {
        private readonly string rootPath;

        /// <summary>
        /// Inizializza la factory con la directory log temporanea.
        /// </summary>
        public ErrorApiFactory(string rootPath)
        {
            this.rootPath = rootPath;
        }

        /// <summary>
        /// Configura file log isolato e ramo che solleva una eccezione tecnica.
        /// </summary>
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Logging:FilePath"] = Path.Combine(rootPath, "logs", "log-.json")
                });
            });
            builder.ConfigureServices(services =>
                services.AddControllers().AddApplicationPart(typeof(TestErrorController).Assembly));
        }
    }
}

/// <summary>
/// Controller disponibile soltanto nell'assembly test per attraversare la pipeline reale degli errori.
/// </summary>
[ApiController]
[Route("test-error")]
public sealed class TestErrorController : ControllerBase
{
    /// <summary>
    /// Genera una eccezione tecnica intercettabile dal middleware globale.
    /// </summary>
    [HttpGet]
    public IActionResult Get() => throw new InvalidOperationException("server-secret C:\\internal\\implementation.cs");
}
