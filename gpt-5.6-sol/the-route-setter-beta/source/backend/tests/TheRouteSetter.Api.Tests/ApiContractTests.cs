using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TheRouteSetter.Api.Models;
using TheRouteSetter.Api.Services.ConvexHull;
using TheRouteSetter.Api.Tests.Support;
using Xunit;

namespace TheRouteSetter.Api.Tests;

public sealed class ApiContractTests : IDisposable
{
    private readonly AssetTestData data = new();
    private readonly AssetApiFactory factory;
    private readonly HttpClient client;

    public ApiContractTests()
    {
        factory = new AssetApiFactory(data.RootPath);
        client = factory.CreateClient();
    }

    [Fact]
    public async Task Status_ReturnsOnlyCurrentReadiness_WithoutReadingLockedGlbs()
    {
        using var model = File.Open(Path.Combine(data.RootPath, "holds", "Hold1", "hold1.glb"), FileMode.Open, FileAccess.Read, FileShare.None);
        var store = factory.Services.GetRequiredService<IColliderJobStore>();
        store.SetStatus("Hold1", ColliderProcessingStatus.Pending);
        var manifest = await client.GetFromJsonAsync<HoldManifest[]>("/api/holds");
        Assert.Equal(ColliderAvailability.Pending, manifest![0].ColliderStatus);

        foreach (var status in new[] { ColliderProcessingStatus.Pending, ColliderProcessingStatus.Ready, ColliderProcessingStatus.Failed })
        {
            store.SetStatus("Hold1", status);
            using var response = await client.GetAsync("/api/holds/status");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(response.Headers.CacheControl?.NoStore);
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(2, document.RootElement.GetArrayLength());
            var hold = document.RootElement[0];
            Assert.Equal(new[] { "colliderStatus", "colliderUrl", "id" }, hold.EnumerateObject().Select(p => p.Name).Order().ToArray());
            Assert.Equal("Hold1", hold.GetProperty("id").GetString());
            Assert.Equal(status.ToString(), hold.GetProperty("colliderStatus").GetString());
            Assert.Equal(status == ColliderProcessingStatus.Ready ? "/api/holds/Hold1/collider" : null,
                hold.GetProperty("colliderUrl").GetString());
        }
    }

    [Theory]
    [InlineData("GET", "/api/absent", 404)]
    [InlineData("GET", "/api/holds/Hold999/model", 404)]
    [InlineData("GET", "/api/holds/Hold999/preview", 404)]
    [InlineData("GET", "/api/holds/Hold999/collider", 404)]
    [InlineData("GET", "/api/holds/Hold1/assets/missing.txt", 404)]
    [InlineData("POST", "/api/holds", 405)]
    [InlineData("GET", "/api/logs", 405)]
    public async Task MissingResourcesAndMethods_UseSafeContract(string method, string path, int status)
    {
        using var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));
        await AssertError(response, status);
    }

    [Fact]
    public async Task MissingWall_UsesJsonRatherThanGlbErrorContentType()
    {
        File.Delete(Path.Combine(data.RootPath, "main-wall", "wall.glb"));
        await AssertError(await client.GetAsync("/api/wall"), 404);
    }

    [Theory]
    [InlineData("/api/wall", 10, "WALL")]
    [InlineData("/api/holds/Hold1/model", 9, "MODE")]
    [InlineData("/api/holds/Hold1/preview", 7, "PREV")]
    [InlineData("/api/holds/Hold1/collider", 15, "{\"ve")]
    [InlineData("/api/holds/Hold1/assets/material.bin", 8, "OPTI")]
    public async Task FileRanges_PreservePartialContentAndNormalizeUnsatisfiableRange(string path, long length, string prefix)
    {
        using var validRequest = new HttpRequestMessage(HttpMethod.Get, path);
        validRequest.Headers.Range = new RangeHeaderValue(0, 3);
        using var partial = await client.SendAsync(validRequest);
        Assert.Equal(HttpStatusCode.PartialContent, partial.StatusCode);
        Assert.Equal(4, partial.Content.Headers.ContentLength);
        Assert.Equal($"bytes 0-3/{length}", partial.Content.Headers.ContentRange?.ToString());
        Assert.Equal(prefix, await partial.Content.ReadAsStringAsync());

        using var invalidRequest = new HttpRequestMessage(HttpMethod.Get, path);
        invalidRequest.Headers.Range = new RangeHeaderValue(length, null);
        using var invalid = await client.SendAsync(invalidRequest);
        await AssertError(invalid, 416);
        Assert.Equal($"bytes */{length}", invalid.Content.Headers.ContentRange?.ToString());
        Assert.NotEqual(0L, invalid.Content.Headers.ContentLength);
        Assert.Null(invalid.Content.Headers.ContentDisposition);
        var error = await invalid.Content.ReadFromJsonAsync<ErrorResponse>();
        var events = await ReadPersistedEventsAsync(item => item.GetProperty("errorId").GetString() == error!.ErrorId);
        try
        {
            var logged = Assert.Single(events, item => item.RootElement.GetProperty("errorId").GetString() == error!.ErrorId);
            Assert.Equal(error!.RequestId, logged.RootElement.GetProperty("requestId").GetString());
        }
        finally { foreach (var item in events) item.Dispose(); }
    }

    [Theory]
    [InlineData("/api/system/health", 200)]
    [InlineData("/api/not-found", 404)]
    public async Task HttpCompletion_IsPersistedThroughHostLogger(string path, int status)
    {
        using var response = await client.GetAsync(path);
        Assert.Equal(status, (int)response.StatusCode);
        var requestId = response.Headers.GetValues("X-Request-Id").Single();
        bool IsCompletion(JsonElement item) => item.GetProperty("requestId").GetString() == requestId
            && item.GetProperty("category").GetString() == "Serilog.AspNetCore.RequestLoggingMiddleware";
        var events = await ReadPersistedEventsAsync(IsCompletion);
        try
        {
            var logged = Assert.Single(events, item => IsCompletion(item.RootElement)).RootElement;
            Assert.Equal("Information", logged.GetProperty("level").GetString());
            Assert.Equal("Serilog.AspNetCore.RequestLoggingMiddleware", logged.GetProperty("category").GetString());
            Assert.StartsWith("HTTP ", logged.GetProperty("message").GetString());
            Assert.Equal("GET", logged.GetProperty("context").GetProperty("RequestMethod").GetString());
            Assert.Equal(path, logged.GetProperty("context").GetProperty("RequestPath").GetString());
            Assert.Equal(status.ToString(), logged.GetProperty("context").GetProperty("StatusCode").GetString());
        }
        finally { foreach (var item in events) item.Dispose(); }
    }

    [Theory]
    [InlineData("{", "application/json", 400)]
    [InlineData("null", "application/json", 400)]
    [InlineData("{}", "application/json", 400)]
    [InlineData("", "application/json", 400)]
    [InlineData("{\"level\":\"SecretEnumName\",\"category\":\"UI\",\"component\":\"Catalog\",\"message\":\"message\"}", "application/json", 400)]
    [InlineData("{\"level\":999,\"category\":\"UI\",\"component\":\"Catalog\",\"message\":\"message\"}", "application/json", 400)]
    [InlineData("{\"level\":\"None\",\"category\":\"UI\",\"component\":\"Catalog\",\"message\":\"message\"}", "application/json", 400)]
    [InlineData("{\"level\":\"Error\",\"category\":\"UI\",\"component\":\"Catalog\",\"message\":\"message\",\"errorId\":\"not-guid\"}", "application/json", 400)]
    [InlineData("{\"level\":\"Error\",\"category\":\"UI\",\"component\":\"Catalog\",\"message\":\"message\",\"requestId\":\"personal data with spaces\"}", "application/json", 400)]
    [InlineData("{\"level\":\"Error\",\"category\":\"UI\",\"component\":\"Catalog\",\"message\":\"message\",\"context\":{\"key\":{\"password\":\"secret\"}}}", "application/json", 400)]
    [InlineData("plain private message", "text/plain", 415)]
    public async Task InvalidLogPayloads_UseSafeContract(string payload, string contentType, int status)
    {
        using var response = await client.PostAsync("/api/logs", new StringContent(payload, Encoding.UTF8, contentType));
        await AssertError(response, status);
    }

    [Fact]
    public async Task OversizedLogs_AreRejectedBeforeModelBinding()
    {
        using var response = await client.PostAsync("/api/logs", new StringContent(new string('x', 32769), Encoding.UTF8, "application/json"));
        await AssertError(response, 413);
    }

    [Theory]
    [InlineData("Trace")]
    [InlineData("Debug")]
    [InlineData("Information")]
    [InlineData("Warning")]
    [InlineData("Error")]
    [InlineData("Critical")]
    public async Task Logs_AcceptsDotNetLevelsAndReturnsCorrelation(string level)
    {
        using var response = await client.PostAsJsonAsync("/api/logs", new { level, category = "UI", component = "Catalog", message = "event" });
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var receipt = await response.Content.ReadFromJsonAsync<FrontendLogResponse>();
        Assert.Equal(response.Headers.GetValues("X-Request-Id").Single(), receipt!.RequestId);
        if (level is "Error" or "Critical") Assert.True(Guid.TryParse(receipt.ErrorId, out _));
        else Assert.Null(receipt.ErrorId);
    }

    [Theory]
    [InlineData("Error", "N")]
    [InlineData("Critical", "D")]
    public async Task Logs_PreservesSuppliedCorrelationAndSanitizesPersistedEvent(string level, string guidFormat)
    {
        var errorId = Guid.NewGuid().ToString(guidFormat);
        var requestId = "original-request:12";
        using var response = await client.PostAsJsonAsync("/api/logs", new
        {
            level, category = "BrowserFailure", component = "Catalog", message = "REPORT-MARKER password=\"private phrase\"",
            errorId, requestId, context = new Dictionary<string, string>
            {
                ["operation"] = "load", ["Context.api-key"] = "api-private", ["unrecognized"] = "unknown personal data",
                ["resource"] = "/api/holds/Hold1/model", ["errorClass"] = "NetworkError", ["event"] = "unhandledrejection"
            }
        });
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var receipt = await response.Content.ReadFromJsonAsync<FrontendLogResponse>();
        Assert.Equal(errorId, receipt!.ErrorId);
        Assert.Equal(requestId, receipt.RequestId);
        Assert.NotEqual(requestId, response.Headers.GetValues("X-Request-Id").Single());
        var events = await ReadPersistedEventsAsync(item => item.GetProperty("errorId").GetString() == errorId);
        try
        {
            var logged = Assert.Single(events, item => item.RootElement.GetProperty("message").GetString()!.Contains("REPORT-MARKER"));
            Assert.Equal(level, logged.RootElement.GetProperty("level").GetString());
            Assert.Equal(errorId, logged.RootElement.GetProperty("errorId").GetString());
            Assert.Equal(requestId, logged.RootElement.GetProperty("requestId").GetString());
            Assert.DoesNotContain("private phrase", logged.RootElement.ToString());
            Assert.DoesNotContain("api-private", logged.RootElement.ToString());
            Assert.DoesNotContain("unknown personal data", logged.RootElement.ToString());
            var context = logged.RootElement.GetProperty("context");
            Assert.Equal("/api/holds/Hold1/model", context.GetProperty("Context.resource").GetString());
            Assert.Equal("NetworkError", context.GetProperty("Context.errorClass").GetString());
            Assert.Equal("unhandledrejection", context.GetProperty("Context.event").GetString());
        }
        finally { foreach (var item in events) item.Dispose(); }
    }

    [Fact]
    public async Task Logs_NewContextKeysRemainSanitized()
    {
        using var response = await client.PostAsJsonAsync("/api/logs", new
        {
            level = "Error", category = "BrowserFailure", component = "Catalog", message = "CONTEXT-SANITIZATION",
            context = new
            {
                resource = "https://example.invalid/model?name=private-query",
                errorClass = "password=\"private phrase\"",
                @event = "person@example.invalid",
                unknown = "unknown private data"
            }
        });
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var receipt = await response.Content.ReadFromJsonAsync<FrontendLogResponse>();
        var events = await ReadPersistedEventsAsync(item => item.GetProperty("errorId").GetString() == receipt!.ErrorId);
        try
        {
            var logged = Assert.Single(events, item => item.RootElement.GetProperty("errorId").GetString() == receipt!.ErrorId).RootElement;
            Assert.DoesNotContain("private", logged.ToString());
            Assert.DoesNotContain("person@example.invalid", logged.ToString());
            foreach (var key in new[] { "resource", "errorClass", "event", "unknown" })
                Assert.Contains("[REDACTED]", logged.GetProperty("context").GetProperty($"Context.{key}").GetString());
        }
        finally { foreach (var item in events) item.Dispose(); }
    }

    [Fact]
    public async Task OpenApi_DocumentsStatusReceiptAndUniformErrors()
    {
        using var document = JsonDocument.Parse(await client.GetStringAsync("/swagger/v1/swagger.json"));
        var paths = document.RootElement.GetProperty("paths");
        var status = paths.GetProperty("/api/holds/status").GetProperty("get").GetProperty("responses").GetProperty("200");
        Assert.Contains("HoldStatus", status.ToString());
        var logs = paths.GetProperty("/api/logs").GetProperty("post").GetProperty("responses");
        Assert.Contains("FrontendLogResponse", logs.GetProperty("202").ToString());
        foreach (var code in new[] { "400", "413", "415", "500" })
            Assert.Contains("ErrorResponse", logs.GetProperty(code).GetProperty("content").GetProperty("application/json").ToString());
        Assert.Contains("ErrorResponse", paths.GetProperty("/api/wall").GetProperty("get").GetProperty("responses").GetProperty("404").ToString());
        foreach (var path in new[] { "/api/wall", "/api/holds/{id}/model", "/api/holds/{id}/preview", "/api/holds/{id}/collider", "/api/holds/{id}/assets/{fileName}" })
        {
            var responses = paths.GetProperty(path).GetProperty("get").GetProperty("responses");
            Assert.True(responses.TryGetProperty("206", out _));
            Assert.Contains("ErrorResponse", responses.GetProperty("416").GetProperty("content").GetProperty("application/json").ToString());
        }
        var colliderSchema = document.RootElement.GetProperty("components").GetProperty("schemas").GetProperty("ColliderDocument");
        Assert.Contains(colliderSchema.GetProperty("required").EnumerateArray(), item => item.GetString() == "indices");
    }

    private async Task<JsonDocument[]> ReadPersistedEventsAsync(Func<JsonElement, bool> containsExpectedEvent)
    {
        await factory.DisposeAsync(); // Svuota la coda bounded prima di leggere i file temporanei.
        // L'host test vincolato puo ritornare durante il rilascio concorrente dell'entry point.
        for (var attempt = 0; attempt < 100; attempt++)
        {
            try
            {
                var lines = Directory.GetFiles(Path.Combine(data.RootPath, "test-logs"), "*.json").SelectMany(File.ReadAllLines);
                var events = lines.Select(line => JsonDocument.Parse(line)).ToArray();
                if (events.Any(item => containsExpectedEvent(item.RootElement))) return events;
                foreach (var item in events) item.Dispose();
            }
            catch (IOException) when (attempt < 99) { }
            await Task.Delay(20);
        }
        Assert.Fail("Evento atteso non persistito entro il timeout.");
        return [];
    }

    private static async Task AssertError(HttpResponseMessage response, int status)
    {
        Assert.Equal(status, (int)response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;
        Assert.Equal(new[] { "errorId", "message", "requestId" }, root.EnumerateObject().Select(item => item.Name).Order().ToArray());
        Assert.True(Guid.TryParse(root.GetProperty("errorId").GetString(), out _));
        Assert.Equal(response.Headers.GetValues("X-Request-Id").Single(), root.GetProperty("requestId").GetString());
        Assert.DoesNotContain("SecretEnumName", root.ToString());
        Assert.DoesNotContain("System.", root.ToString());
        Assert.DoesNotContain("private", root.ToString());
    }

    public void Dispose() { client.Dispose(); factory.Dispose(); data.Dispose(); }
}
