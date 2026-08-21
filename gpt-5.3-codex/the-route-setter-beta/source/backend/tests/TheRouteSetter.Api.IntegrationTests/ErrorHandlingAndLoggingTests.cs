using TheRouteSetter.Api.Contracts;

namespace TheRouteSetter.Api.IntegrationTests;

public sealed class ErrorHandlingAndLoggingTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient httpClient;

    public ErrorHandlingAndLoggingTests(ApiFactory factory)
    {
        httpClient = factory.CreateClient();
    }

    [Fact]
    public async Task ReturnsSafeErrorContractWhenUnhandledExceptionOccurs()
    {
        HttpResponseMessage response = await httpClient.GetAsync("/api/diagnostics/throw");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        ApiErrorResponseDto? payload = await response.Content.ReadFromJsonAsync<ApiErrorResponseDto>();
        Assert.NotNull(payload);
        Assert.False(string.IsNullOrWhiteSpace(payload!.ErrorId));
        Assert.DoesNotContain("stack", payload.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("path", payload.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("exception", payload.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RejectsInvalidFrontendLogPayload()
    {
        var invalidPayload = new FrontendLogRequestDto(
            Level: string.Empty,
            Category: "frontend.runtime",
            Message: string.Empty,
            Context: null,
            ErrorId: null);

        HttpResponseMessage response = await httpClient.PostAsJsonAsync("/api/logs", invalidPayload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AcceptsFrontendLogPayloadAndReturnsLogId()
    {
        var payload = new FrontendLogRequestDto(
            Level: "Error",
            Category: "frontend.runtime",
            Message: "token=abc123",
            Context: new Dictionary<string, string>
            {
                ["authorization"] = "Bearer secret"
            },
            ErrorId: Guid.NewGuid().ToString("N"));

        HttpResponseMessage response = await httpClient.PostAsJsonAsync("/api/logs", payload);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        FrontendLogResponseDto? body = await response.Content.ReadFromJsonAsync<FrontendLogResponseDto>();
        Assert.NotNull(body);
        Assert.Equal("accepted", body!.Status);
        Assert.False(string.IsNullOrWhiteSpace(body.LogId));
    }
}
