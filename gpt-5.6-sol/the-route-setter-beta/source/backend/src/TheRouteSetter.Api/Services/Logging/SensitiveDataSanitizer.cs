using System.Text.RegularExpressions;

namespace TheRouteSetter.Api.Services.Logging;

/// <summary>
/// Rimuove dai log credenziali, token e valori associati a chiavi sensibili comuni.
/// </summary>
public interface ISensitiveDataSanitizer
{
    /// <summary>
    /// Restituisce una versione mascherata e dimensionalmente limitata del testo.
    /// </summary>
    string Sanitize(string? value, int maxLength = 4000);
}

/// <summary>
/// Implementa una sanitizzazione deterministica dei dati diagnostici.
/// </summary>
public sealed partial class SensitiveDataSanitizer : ISensitiveDataSanitizer
{
    private const string Mask = "[REDACTED]";

    /// <inheritdoc />
    public string Sanitize(string? value, int maxLength = 4000)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        // Bound work before running regexes; an oversized diagnostic is not persisted raw.
        if (value.Length > 32768 || maxLength <= 0) return Mask;
        try
        {
            var sanitized = SensitiveAssignment().Replace(value, match => $"{match.Groups[1].Value}={Mask}");
            sanitized = Authentication().Replace(sanitized, "$1 " + Mask);
            sanitized = PersonalData().Replace(sanitized, Mask);
            sanitized = UrlQuery().Replace(sanitized, "$1" + Mask);
            return sanitized.Length <= maxLength ? sanitized : sanitized[..maxLength];
        }
        catch (RegexMatchTimeoutException)
        {
            return Mask;
        }
    }

    /// <summary>Riconosce anche chiavi prefissate e varianti con separatori.</summary>
    public static bool IsSensitiveKey(string key)
    {
        var normalized = new string(key.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());
        return SensitiveKeys.Any(normalized.Contains);
    }

    private static readonly string[] SensitiveKeys =
    ["password", "passwd", "pwd", "token", "apikey", "secret", "authorization", "cookie", "credential",
        "connectionstring", "userid", "uid", "username", "email", "phone", "address", "fullname", "firstname", "lastname"];

    /// <summary>Riconosce credenziali Basic e Bearer con un tempo massimo di ricerca limitato.</summary>
    [GeneratedRegex("(?i)\\b(Basic|Bearer)\\s+[A-Za-z0-9._~+/-]+=*", RegexOptions.CultureInvariant, 100)]
    private static partial Regex Authentication();

    /// <summary>Individua assegnazioni a chiavi sensibili, inclusi valori quotati e nomi prefissati.</summary>
    [GeneratedRegex("(?i)([\\w.\\-]*(?:password|passwd|pwd|token|api[-_ ]?key|secret|authorization|cookie|credential|connection[-_ ]?string|user[-_ ]?id|uid|username|email|phone|address|full[-_ ]?name)[\\w.\\-]*)[\\\"']?\\s*[:=]\\s*(?:\\\"(?:\\\\.|[^\\\"\\\\])*\\\"|'(?:\\\\.|[^'\\\\])*'|[^,;\\r\\n}]+)", RegexOptions.CultureInvariant, 100)]
    private static partial Regex SensitiveAssignment();

    /// <summary>Riconosce indirizzi email, IPv4 e numeri telefonici internazionali da mascherare.</summary>
    [GeneratedRegex(@"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:\d{1,3}\.){3}\d{1,3}\b|(?<!\w)\+\d[\d ()-]{7,}\d", RegexOptions.CultureInvariant, 100)]
    private static partial Regex PersonalData();

    /// <summary>Separa la query di un URL HTTP per mascherarne i valori diagnostici.</summary>
    [GeneratedRegex(@"(?i)(https?://[^\s?]+\?)[^\s]+", RegexOptions.CultureInvariant, 100)]
    private static partial Regex UrlQuery();
}
