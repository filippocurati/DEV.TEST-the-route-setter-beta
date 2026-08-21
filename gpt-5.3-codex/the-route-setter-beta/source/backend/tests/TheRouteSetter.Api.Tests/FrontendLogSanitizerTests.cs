using TheRouteSetter.Api.Services;

namespace TheRouteSetter.Api.Tests;

public sealed class FrontendLogSanitizerTests
{
    [Fact]
    public void RedactsSensitiveTokensInText()
    {
        string raw = "token=abc123 password=secret";

        string sanitized = FrontendLogSanitizer.SanitizeText(raw);

        Assert.DoesNotContain("token", sanitized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password", sanitized, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("[REDACTED]", sanitized);
    }

    [Fact]
    public void RedactsSensitiveContextKeys()
    {
        Dictionary<string, string> context = new()
        {
            ["operation"] = "move",
            ["authorization"] = "Bearer abc"
        };

        IDictionary<string, string> sanitized = FrontendLogSanitizer.SanitizeContext(context);

        Assert.Equal("move", sanitized["operation"]);
        Assert.Equal("[REDACTED]", sanitized["authorization"]);
    }
}
