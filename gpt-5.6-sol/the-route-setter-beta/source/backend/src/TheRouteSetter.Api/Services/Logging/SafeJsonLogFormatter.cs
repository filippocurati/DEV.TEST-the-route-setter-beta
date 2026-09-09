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
        var safeEvent = new LogEvent(logEvent.Timestamp, logEvent.Level, null, logEvent.MessageTemplate,
            logEvent.Properties.Take(100).Select(item => new LogEventProperty(item.Key, SanitizeProperty(item.Key, item.Value))));
        var properties = safeEvent.Properties.GroupBy(item => sanitizer.Sanitize(item.Key, 200), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => sanitizer.Sanitize(Render(group.First().Value), 2000), StringComparer.Ordinal);
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
            level = logEvent.Level switch { LogEventLevel.Verbose => "Trace", LogEventLevel.Fatal => "Critical", _ => logEvent.Level.ToString() },
            category = sanitizer.Sanitize(category, 200),
            message = sanitizer.Sanitize(safeEvent.RenderMessage(), 4000),
            component = sanitizer.Sanitize(component, 200),
            requestId = Get(safeEvent.Properties, "RequestId"),
            errorId = Get(safeEvent.Properties, "ErrorId"),
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
    /// Sanitizza ricorsivamente le proprieta prima del rendering del messaggio.
    /// </summary>
    private LogEventPropertyValue SanitizeProperty(string key, LogEventPropertyValue value, int depth = 0)
    {
        if (depth >= 8 || SensitiveDataSanitizer.IsSensitiveKey(key)) return new ScalarValue("[REDACTED]");
        return value switch
        {
            ScalarValue { Value: string text } => new ScalarValue(sanitizer.Sanitize(text, 2000)),
            ScalarValue scalar when scalar.Value is null or bool or byte or short or int or long or float or double or decimal or Guid or DateTime or DateTimeOffset => scalar,
            StructureValue structure => new StructureValue(structure.Properties.Take(50)
                .Select(item => new LogEventProperty(sanitizer.Sanitize(item.Name, 200), SanitizeProperty(item.Name, item.Value, depth + 1)))),
            DictionaryValue dictionary => new DictionaryValue(dictionary.Elements.Take(50)
                .GroupBy(item => sanitizer.Sanitize(item.Key.Value?.ToString(), 80))
                .Select(group => new KeyValuePair<ScalarValue, LogEventPropertyValue>(new ScalarValue(group.Key),
                    SanitizeProperty(group.First().Key.Value?.ToString() ?? "", group.First().Value, depth + 1)))),
            SequenceValue sequence => new SequenceValue(sequence.Elements.Take(50).Select(item => SanitizeProperty("", item, depth + 1))),
            _ => new ScalarValue("[REDACTED]")
        };
    }
}
