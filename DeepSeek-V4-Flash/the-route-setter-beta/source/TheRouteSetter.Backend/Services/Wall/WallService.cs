using TheRouteSetter.Backend.Models;

namespace TheRouteSetter.Backend.Services.Wall;

/// <summary>
/// Servizio per la gestione delle informazioni sulla parete principale.
/// </summary>
public class WallService
{
    private readonly string _wallDirectory;
    private readonly ILogger<WallService> _logger;

    /// <summary>
    /// Inizializza il servizio con il percorso della directory della parete.
    /// </summary>
    public WallService(IConfiguration configuration, IWebHostEnvironment env, ILogger<WallService> logger)
    {
        var dataRoot = configuration.GetValue<string>("DataPaths:Root") ?? "Data";
        var basePath = Path.IsPathRooted(dataRoot) ? dataRoot : Path.Combine(env.ContentRootPath, dataRoot);
        _wallDirectory = Path.Combine(basePath, "main-wall");
        _logger = logger;
    }

    /// <summary>
    /// Recupera le informazioni sulla parete principale.
    /// </summary>
    public WallInfo GetWallInfo()
    {
        if (!Directory.Exists(_wallDirectory))
        {
            _logger.LogWarning("Cartella main-wall non trovata in {Path}", _wallDirectory);
            return new WallInfo();
        }

        var glbFile = Directory.GetFiles(_wallDirectory, "*.glb").FirstOrDefault();
        if (glbFile == null)
        {
            _logger.LogWarning("Nessun file GLB trovato in {Path}", _wallDirectory);
            return new WallInfo();
        }

        return new WallInfo
        {
            Id = "main-wall",
            Name = "Parete principale",
            ModelUrl = $"/static/main-wall/{Path.GetFileName(glbFile)}"
        };
    }

    /// <summary>
    /// Verifica che il modello della parete sia disponibile.
    /// </summary>
    public bool IsWallAvailable()
    {
        if (!Directory.Exists(_wallDirectory)) return false;
        return Directory.GetFiles(_wallDirectory, "*.glb").Any();
    }
}