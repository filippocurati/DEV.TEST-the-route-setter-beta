namespace TheRouteSetter.Api.Services;

public static class FrontendLogSanitizer
{
    private static readonly string[] SensitiveTokens =
    [
        "password",
        "passwd",
        "token",
        "secret",
        "authorization",
        "apikey",
        "api_key"
    ];

    public static string SanitizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        string sanitized = value;
        foreach (string token in SensitiveTokens)
        {
            if (sanitized.Contains(token, StringComparison.OrdinalIgnoreCase))
            {
                sanitized = RedactTokenOccurrences(sanitized, token);
            }
        }

        return sanitized;
    }

    public static IDictionary<string, string> SanitizeContext(IDictionary<string, string>? context)
    {
        if (context is null || context.Count == 0)
        {
            return new Dictionary<string, string>();
        }

        Dictionary<string, string> sanitized = new(StringComparer.OrdinalIgnoreCase);
        foreach ((string key, string value) in context)
        {
            bool sensitiveKey = SensitiveTokens.Any(token => key.Contains(token, StringComparison.OrdinalIgnoreCase));
            sanitized[key] = sensitiveKey ? "[REDACTED]" : SanitizeText(value);
        }

        return sanitized;
    }

    private static string RedactTokenOccurrences(string input, string token)
    {
        string current = input;
        int index = current.IndexOf(token, StringComparison.OrdinalIgnoreCase);
        while (index >= 0)
        {
            current = string.Concat(current.AsSpan(0, index), "[REDACTED]", current.AsSpan(index + token.Length));
            index = current.IndexOf(token, StringComparison.OrdinalIgnoreCase);
        }

        return current;
    }
}
