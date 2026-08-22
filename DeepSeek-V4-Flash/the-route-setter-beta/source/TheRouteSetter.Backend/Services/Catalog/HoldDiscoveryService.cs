using TheRouteSetter.Backend.Models;

namespace TheRouteSetter.Backend.Services.Catalog;

/// <summary>
/// Servizio per la scoperta e la gestione del catalogo delle prese.
/// </summary>
public class HoldDiscoveryService
{
    private readonly string _holdsDirectory;
    private readonly ILogger<HoldDiscoveryService> _logger;

    /// <summary>
    /// Inizializza il servizio con il percorso della directory delle prese.
    /// </summary>
    public HoldDiscoveryService(IConfiguration configuration, IWebHostEnvironment env, ILogger<HoldDiscoveryService> logger)
    {
        var dataRoot = configuration.GetValue<string>("DataPaths:Root") ?? "Data";
        var basePath = Path.IsPathRooted(dataRoot) ? dataRoot : Path.Combine(env.ContentRootPath, dataRoot);
        _holdsDirectory = Path.Combine(basePath, "holds");
        _logger = logger;
    }

    /// <summary>
    /// Scansiona la directory holds e restituisce il manifest completo del catalogo.
    /// </summary>
    public List<HoldManifest> DiscoverHolds()
    {
        var manifests = new List<HoldManifest>();

        if (!Directory.Exists(_holdsDirectory))
        {
            _logger.LogWarning("Cartella holds non trovata in {Path}", _holdsDirectory);
            return manifests;
        }

        foreach (var holdDir in Directory.GetDirectories(_holdsDirectory))
        {
            var dirName = Path.GetFileName(holdDir);
            if (!IsValidHoldDirectory(dirName)) continue;

            try
            {
                var manifest = BuildHoldManifest(holdDir, dirName);
                if (manifest != null)
                {
                    manifests.Add(manifest);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Errore durante la scansione della presa {HoldDir}", holdDir);
            }
        }

        return manifests;
    }

    /// <summary>
    /// Verifica se il nome della directory corrisponde al formato Hold&lt;numero&gt;.
    /// </summary>
    private static bool IsValidHoldDirectory(string dirName)
    {
        return System.Text.RegularExpressions.Regex.IsMatch(dirName, @"^Hold\d+$");
    }

    /// <summary>
    /// Restituisce il percorso assoluto della directory holds (utile per il background worker).
    /// </summary>
    public string? GetHoldsRootPath()
    {
        return Directory.Exists(_holdsDirectory) ? _holdsDirectory : null;
    }

    /// <summary>
    /// Costruisce il manifest per una singola presa.
    /// </summary>
    private HoldManifest? BuildHoldManifest(string holdDir, string dirName)
    {
        var glbFile = Directory.GetFiles(holdDir, "*.glb").FirstOrDefault();
        if (glbFile == null)
        {
            _logger.LogWarning("Nessun file GLB trovato per la presa {HoldId} in {Path}", dirName, holdDir);
            return null;
        }

        var previewFile = Directory.GetFiles(holdDir, "PREV_*").FirstOrDefault();
        var colliderFile = Directory.GetFiles(holdDir, "collider.json").FirstOrDefault();

        return new HoldManifest
        {
            Id = dirName,
            PreviewUrl = previewFile != null
                ? $"/static/holds/{dirName}/{Path.GetFileName(previewFile)}"
                : string.Empty,
            ModelUrl = $"/static/holds/{dirName}/{Path.GetFileName(glbFile)}",
            ColliderUrl = colliderFile != null
                ? $"/static/holds/{dirName}/{Path.GetFileName(colliderFile)}"
                : string.Empty,
            ColliderReady = colliderFile != null
        };
    }
}