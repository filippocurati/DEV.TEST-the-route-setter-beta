using System.Text.RegularExpressions;

namespace TheRouteSetter.Api.Services.Logging;

/// <summary>Retention per eta effettiva, eseguita dal consumer anche nei giorni senza eventi.</summary>
/// <param name="filePath">Percorso base da cui ricavare cartella e pattern dei file rolling autorizzati.</param>
/// <param name="retentionDays">Eta massima in giorni, vincolata ad almeno un giorno.</param>
public sealed class LogFileRetention(string filePath, int retentionDays)
{
    private DateTime? lastSweepDate;
    private readonly string directory = Path.GetDirectoryName(filePath)!;
    private readonly Regex fileName = new("^" + Regex.Escape(Path.GetFileNameWithoutExtension(filePath))
        + @"\d{8}(?:_\d+)?" + Regex.Escape(Path.GetExtension(filePath)) + "$", RegexOptions.CultureInvariant);

    /// <summary>Rimuove solo file rolling del pattern configurato, al primo controllo del giorno UTC.</summary>
    public int SweepIfDue(DateTime utcNow)
    {
        if (lastSweepDate == utcNow.Date) return 0;
        var deleted = 0;
        try
        {
            foreach (var path in Directory.EnumerateFiles(directory))
            {
                if (!fileName.IsMatch(Path.GetFileName(path))) continue;
                try
                {
                    if (File.GetLastWriteTimeUtc(path) < utcNow.AddDays(-Math.Max(1, retentionDays)))
                    {
                        File.Delete(path);
                        deleted++;
                    }
                }
                catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
                {
                    Serilog.Debugging.SelfLog.WriteLine("Log retention could not remove a file.");
                }
            }
            lastSweepDate = utcNow.Date;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            Serilog.Debugging.SelfLog.WriteLine("Log retention could not enumerate its directory.");
        }
        return deleted;
    }
}
