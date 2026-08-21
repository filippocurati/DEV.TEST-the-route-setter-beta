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

        var sanitized = BearerToken().Replace(value, "$1" + Mask);
        sanitized = SensitiveAssignment().Replace(sanitized, match => $"{match.Groups[1].Value}{match.Groups[2].Value}{Mask}");
        sanitized = ConnectionSecret().Replace(sanitized, match => $"{match.Groups[1].Value}={Mask}");
        return sanitized.Length <= maxLength ? sanitized : sanitized[..maxLength];
    }

    [GeneratedRegex("(?i)(authorization\\s*[:=]\\s*bearer\\s+|bearer\\s+)[A-Za-z0-9._~+/-]+=*")]
    private static partial Regex BearerToken();

    [GeneratedRegex("(?i)(\\\"?(?:password|passwd|pwd|token|access_token|refresh_token|api[-_]?key|secret)\\\"?)(\\s*[:=]\\s*\\\"?)[^\\s,;\\\"}]+")]
    private static partial Regex SensitiveAssignment();

    [GeneratedRegex("(?i)(password|user id|uid|access key|secret key)\\s*=\\s*[^;\\s]+")]
    private static partial Regex ConnectionSecret();
}
