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
    private readonly FileExtensionContentTypeProvider contentTypes = new();

    /// <summary>
    /// Inizializza il servizio risolvendo la radice rispetto al content root del backend.
    /// </summary>
    public FileSystemAssetCatalogService(
        IOptions<AssetStorageOptions> options,
        IWebHostEnvironment environment,
        IColliderJobStore colliderJobs)
    {
        var rootPath = Path.GetFullPath(options.Value.RootPath, environment.ContentRootPath);
        wallDirectory = Path.Combine(rootPath, options.Value.MainWallDirectory);
        holdsDirectory = Path.Combine(rootPath, options.Value.HoldsDirectory);
        this.colliderJobs = colliderJobs;
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

        return Directory.EnumerateDirectories(holdsDirectory)
            .Where(path => HoldDirectoryName().IsMatch(Path.GetFileName(path)))
            .Select(CreateDescriptor)
            .Where(descriptor => descriptor is not null)
            .OrderBy(descriptor => descriptor!.Number)
            .ThenBy(descriptor => descriptor!.Manifest.Id, StringComparer.Ordinal)
            .Select(descriptor => descriptor!.Manifest)
            .ToArray();
    }

    /// <inheritdoc />
    public IReadOnlyList<HoldModelAsset> GetHoldModels()
    {
        if (!Directory.Exists(holdsDirectory))
        {
            return [];
        }

        return Directory.EnumerateDirectories(holdsDirectory)
            .Where(path => HoldDirectoryName().IsMatch(Path.GetFileName(path)))
            .Select(path => new { Id = Path.GetFileName(path), ModelPath = FindSingleFile(path, "*.glb") })
            .Where(item => item.ModelPath is not null)
            .OrderBy(item => int.Parse(HoldDirectoryName().Match(item.Id).Groups[1].Value, CultureInfo.InvariantCulture))
            .ThenBy(item => item.Id, StringComparer.Ordinal)
            .Select(item => new HoldModelAsset(item.Id, item.ModelPath!))
            .ToArray();
    }

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
        var id = Path.GetFileName(directory);
        var match = HoldDirectoryName().Match(id);
        var modelPath = FindSingleFile(directory, "*.glb");
        if (!match.Success || modelPath is null)
        {
            return null;
        }

        var previewPath = FindSingleFile(directory, "PREV_*.*");
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

        var optionalFiles = Directory.EnumerateFiles(directory)
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
            int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture),
            directory,
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
        if (!HoldDirectoryName().IsMatch(id) || !Directory.Exists(holdsDirectory))
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
    [GeneratedRegex("^Hold([0-9]+)$", RegexOptions.CultureInvariant)]
    private static partial Regex HoldDirectoryName();

    /// <summary>
    /// Conserva i dati interni necessari a ordinamento e accesso controllato degli asset.
    /// </summary>
    private sealed record HoldDescriptor(
        int Number,
        string Directory,
        IReadOnlyList<string> OptionalFiles,
        HoldManifest Manifest);
}
