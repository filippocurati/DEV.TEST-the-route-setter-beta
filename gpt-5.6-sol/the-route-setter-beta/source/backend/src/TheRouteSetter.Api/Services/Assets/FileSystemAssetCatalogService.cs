using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;
using TheRouteSetter.Api.Models;
using TheRouteSetter.Api.Services.ConvexHull;

namespace TheRouteSetter.Api.Services.Assets;

/// <summary>
/// Esegue la discovery degli asset locali applicando il naming Hold&lt;numero&gt;.
/// </summary>
public sealed partial class FileSystemAssetCatalogService : IAssetCatalogService
{
    private const string ColliderFileName = "collider.json";
    private readonly string wallDirectory;
    private readonly string holdsDirectory;
    private readonly IColliderJobStore colliderJobs;
    private readonly ILogger<FileSystemAssetCatalogService> logger;
    private readonly AssetDirectoryReader directories;
    private readonly FileExtensionContentTypeProvider contentTypes = new();

    /// <summary>
    /// Inizializza il servizio risolvendo la radice rispetto al content root del backend.
    /// </summary>
    public FileSystemAssetCatalogService(
        IOptions<AssetStorageOptions> options,
        IWebHostEnvironment environment,
        IColliderJobStore colliderJobs,
        ILogger<FileSystemAssetCatalogService> logger,
        AssetDirectoryReader directories)
    {
        var rootPath = Path.GetFullPath(options.Value.RootPath, environment.ContentRootPath);
        wallDirectory = Path.Combine(rootPath, options.Value.MainWallDirectory);
        holdsDirectory = Path.Combine(rootPath, options.Value.HoldsDirectory);
        this.colliderJobs = colliderJobs;
        this.logger = logger;
        this.directories = directories;
    }

    /// <inheritdoc />
    public AssetFile? GetWall()
    {
        var path = FindSingleFile(wallDirectory, "*.glb");
        return path is null ? null : CreateAsset(path, "model/gltf-binary");
    }

    /// <inheritdoc />
    public IReadOnlyList<HoldManifest> GetHolds()
    {
        if (!Directory.Exists(holdsDirectory))
        {
            return [];
        }

        return Discover().Select(descriptor => descriptor.Manifest).ToArray();
    }

    /// <inheritdoc />
    public IReadOnlyList<HoldStatus> GetHoldStatuses() => Discover()
        .Select(descriptor => new HoldStatus(descriptor.Manifest.Id,
            descriptor.Manifest.ColliderStatus, descriptor.Manifest.ColliderUrl)).ToArray();

    /// <inheritdoc />
    public IReadOnlyList<HoldModelAsset> GetHoldModels()
    {
        if (!Directory.Exists(holdsDirectory))
        {
            return [];
        }

        return Discover().Select(descriptor => new HoldModelAsset(descriptor.Manifest.Id, descriptor.ModelPath)).ToArray();
    }

    /// <summary>Isola i guasti di enumerazione e ordina i descrittori validi per numero e identificativo.</summary>
    private IReadOnlyList<HoldDescriptor> Discover()
    {
        string[] paths;
        try
        {
            paths = directories.GetDirectories(holdsDirectory);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            LogDiscoveryFailure(exception);
            return [];
        }

        return paths.Select(CreateDescriptor).OfType<HoldDescriptor>()
            .OrderBy(descriptor => descriptor.Number)
            .ThenBy(descriptor => descriptor.Manifest.Id, StringComparer.Ordinal).ToArray();
    }

    /// <summary>Registra il guasto di discovery con un identificativo correlabile senza interrompere le altre cartelle.</summary>
    private void LogDiscoveryFailure(Exception exception) => logger.LogError(exception,
        "Discovery asset non riuscita, errore {ErrorId}", Guid.NewGuid().ToString("N"));

    /// <inheritdoc />
    public AssetFile? GetHoldModel(string id)
    {
        var directory = ResolveHoldDirectory(id);
        var path = directory is null ? null : FindSingleFile(directory, "*.glb");
        return path is null ? null : CreateAsset(path, "model/gltf-binary");
    }

    /// <inheritdoc />
    public AssetFile? GetHoldPreview(string id)
    {
        var directory = ResolveHoldDirectory(id);
        var path = directory is null ? null : FindSingleFile(directory, "PREV_*.*");
        return path is null ? null : CreateAsset(path);
    }

    /// <inheritdoc />
    public AssetFile? GetHoldCollider(string id)
    {
        var directory = ResolveHoldDirectory(id);
        var path = directory is null ? null : Path.Combine(directory, ColliderFileName);
        return path is not null
            && File.Exists(path)
            && colliderJobs.GetStatus(id, colliderFileExists: true) == ColliderProcessingStatus.Ready
                ? CreateAsset(path, "application/json")
                : null;
    }

    /// <inheritdoc />
    public AssetFile? GetHoldOptionalAsset(string id, string fileName)
    {
        if (Path.GetFileName(fileName) != fileName)
        {
            return null;
        }

        var descriptor = ResolveDescriptor(id);
        if (descriptor is null || !descriptor.OptionalFiles.Contains(fileName, StringComparer.OrdinalIgnoreCase))
        {
            return null;
        }

        return CreateAsset(Path.Combine(descriptor.Directory, fileName));
    }

    /// <summary>
    /// Costruisce il descrittore di una cartella valida senza leggere il contenuto dei file.
    /// </summary>
    private HoldDescriptor? CreateDescriptor(string directory)
    {
        try
        {
            return ReadDescriptor(directory);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            LogDiscoveryFailure(exception);
            return null;
        }
    }

    /// <summary>Compone manifest e risorse opzionali dai nomi dei file e dallo stato del job collider.</summary>
    private HoldDescriptor? ReadDescriptor(string directory)
    {
        var id = Path.GetFileName(directory);
        var match = HoldDirectoryName().Match(id);
        if (!match.Success || !int.TryParse(match.Groups[1].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var number))
        {
            return null;
        }

        var files = directories.GetFiles(directory).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        var modelPath = files.FirstOrDefault(path => Path.GetExtension(path).Equals(".glb", StringComparison.OrdinalIgnoreCase));
        if (modelPath is null)
        {
            return null;
        }

        var previewPath = files.FirstOrDefault(path => Path.GetFileName(path).StartsWith("PREV_", StringComparison.OrdinalIgnoreCase));
        var colliderPath = Path.Combine(directory, ColliderFileName);
        var excludedFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            Path.GetFileName(modelPath),
            ColliderFileName
        };
        if (previewPath is not null)
        {
            excludedFiles.Add(Path.GetFileName(previewPath));
        }

        var optionalFiles = files
            .Select(path => Path.GetFileName(path)!)
            .Where(fileName => !excludedFiles.Contains(fileName))
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var encodedId = Uri.EscapeDataString(id);
        var colliderReady = File.Exists(colliderPath);
        var colliderStatus = colliderJobs.GetStatus(id, colliderReady);
        var availability = colliderStatus switch
        {
            ColliderProcessingStatus.Pending => ColliderAvailability.Pending,
            ColliderProcessingStatus.Ready => ColliderAvailability.Ready,
            ColliderProcessingStatus.Failed => ColliderAvailability.Failed,
            _ => ColliderAvailability.Missing
        };
        var manifest = new HoldManifest(
            id,
            previewPath is null ? null : $"/api/holds/{encodedId}/preview",
            $"/api/holds/{encodedId}/model",
            availability == ColliderAvailability.Ready ? $"/api/holds/{encodedId}/collider" : null,
            availability,
            optionalFiles.Select(fileName => $"/api/holds/{encodedId}/assets/{Uri.EscapeDataString(fileName)}").ToArray());

        return new HoldDescriptor(
            number,
            directory,
            modelPath,
            optionalFiles,
            manifest);
    }

    /// <summary>
    /// Risolve e descrive una presa valida a partire dal suo identificativo.
    /// </summary>
    private HoldDescriptor? ResolveDescriptor(string id)
    {
        var directory = ResolveHoldDirectory(id);
        return directory is null ? null : CreateDescriptor(directory);
    }

    /// <summary>
    /// Restituisce esclusivamente cartelle esistenti con naming Hold seguito da un numero.
    /// </summary>
    private string? ResolveHoldDirectory(string id)
    {
        var match = HoldDirectoryName().Match(id);
        if (!match.Success || !int.TryParse(match.Groups[1].Value, NumberStyles.None, CultureInfo.InvariantCulture, out _)
            || !Directory.Exists(holdsDirectory))
        {
            return null;
        }

        var path = Path.Combine(holdsDirectory, id);
        return Directory.Exists(path) ? path : null;
    }

    /// <summary>
    /// Seleziona in modo deterministico il primo file corrispondente al pattern.
    /// </summary>
    private static string? FindSingleFile(string directory, string pattern)
    {
        return Directory.Exists(directory)
            ? Directory.EnumerateFiles(directory, pattern).Order(StringComparer.OrdinalIgnoreCase).FirstOrDefault()
            : null;
    }

    /// <summary>
    /// Crea un riferimento scaricabile determinando il tipo MIME del file.
    /// </summary>
    private AssetFile CreateAsset(string path, string? fallbackContentType = null)
    {
        var contentType = contentTypes.TryGetContentType(path, out var detected)
            ? detected
            : fallbackContentType ?? "application/octet-stream";
        return new AssetFile(path, contentType);
    }

    /// <summary>
    /// Restituisce l'espressione regolare compilata per il naming delle prese.
    /// </summary>
    [GeneratedRegex(@"\AHold([0-9]+)\z", RegexOptions.CultureInvariant)]
    private static partial Regex HoldDirectoryName();

    /// <summary>
    /// Conserva i dati interni necessari a ordinamento e accesso controllato degli asset.
    /// </summary>
    private sealed record HoldDescriptor(
        int Number,
        string Directory,
        string ModelPath,
        IReadOnlyList<string> OptionalFiles,
        HoldManifest Manifest);
}
