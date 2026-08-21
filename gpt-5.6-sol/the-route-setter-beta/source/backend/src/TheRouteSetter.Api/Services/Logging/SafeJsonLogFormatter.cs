using System.Text.Json;
using Serilog.Events;
using Serilog.Formatting;

namespace TheRouteSetter.Api.Services.Logging;

/// <summary>
/// Produce un evento JSON line-oriented con campi stabili e valori sanitizzati.
/// </summary>
public sealed class SafeJsonLogFormatter : ITextFormatter
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly ISensitiveDataSanitizer sanitizer;

    /// <summary>
    /// Inizializza il formatter con la policy di sanitizzazione condivisa.
    /// </summary>
    public SafeJsonLogFormatter(ISensitiveDataSanitizer sanitizer)
    {
        this.sanitizer = sanitizer;
    }

    /// <summary>
    /// Serializza un singolo evento come oggetto JSON terminato da newline.
    /// </summary>
    public void Format(LogEvent logEvent, TextWriter output)
    {
        var properties = logEvent.Properties.ToDictionary(
            item => item.Key,
            item => IsSensitiveKey(item.Key) ? "[REDACTED]" : sanitizer.Sanitize(Render(item.Value), 2000),
            StringComparer.Ordinal);
        var category = Get(properties, "Category") ?? Get(properties, "SourceContext") ?? "Application";
        var component = Get(properties, "Component") ?? "Backend";
        properties.Remove("Category");
        properties.Remove("Component");
        properties.Remove("RequestId");
        properties.Remove("ErrorId");
        properties.Remove("SourceContext");

        var document = new
        {
            timestamp = logEvent.Timestamp.UtcDateTime,
            level = logEvent.Level.ToString(),
            category = sanitizer.Sanitize(category, 200),
            message = sanitizer.Sanitize(logEvent.RenderMessage(), 4000),
            component = sanitizer.Sanitize(component, 200),
            requestId = Get(logEvent.Properties, "RequestId"),
            errorId = Get(logEvent.Properties, "ErrorId"),
            exception = logEvent.Exception is null ? null : sanitizer.Sanitize(logEvent.Exception.ToString(), 16000),
            context = properties.Count == 0 ? null : properties
        };

        output.Write(JsonSerializer.Serialize(document, JsonOptions));
        output.WriteLine();
    }

    /// <summary>
    /// Estrae una proprieta gia convertita in testo.
    /// </summary>
    private static string? Get(IReadOnlyDictionary<string, string> properties, string key) =>
        properties.TryGetValue(key, out var value) ? value : null;

    /// <summary>
    /// Estrae e sanitizza implicitamente una proprieta Serilog scalare.
    /// </summary>
    private string? Get(IReadOnlyDictionary<string, LogEventPropertyValue> properties, string key) =>
        properties.TryGetValue(key, out var value) ? sanitizer.Sanitize(Render(value), 200) : null;

    /// <summary>
    /// Converte una proprieta strutturata nella sua rappresentazione testuale invariabile.
    /// </summary>
    private static string Render(LogEventPropertyValue value)
    {
        using var writer = new StringWriter(System.Globalization.CultureInfo.InvariantCulture);
        value.Render(writer, format: null, formatProvider: System.Globalization.CultureInfo.InvariantCulture);
        return writer.ToString().Trim('"');
    }

    /// <summary>
    /// Riconosce proprietà il cui nome identifica direttamente un dato sensibile.
    /// </summary>
    private static bool IsSensitiveKey(string key) =>
        key.Contains("password", StringComparison.OrdinalIgnoreCase)
        || key.Contains("passwd", StringComparison.OrdinalIgnoreCase)
        || key.Contains("token", StringComparison.OrdinalIgnoreCase)
        || key.Contains("secret", StringComparison.OrdinalIgnoreCase)
        || key.Contains("apiKey", StringComparison.OrdinalIgnoreCase)
        || key.Contains("api_key", StringComparison.OrdinalIgnoreCase)
        || key.Equals("Authorization", StringComparison.OrdinalIgnoreCase);
}
