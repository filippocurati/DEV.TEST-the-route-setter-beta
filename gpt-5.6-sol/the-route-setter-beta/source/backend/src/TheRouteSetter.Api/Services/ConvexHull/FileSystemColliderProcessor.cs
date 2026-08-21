using System.Security.Cryptography;
using System.Text.Json;

namespace TheRouteSetter.Api.Services.ConvexHull;

/// <summary>
/// Mantiene il collider JSON coerente con l'hash del modello GLB sorgente.
/// </summary>
public sealed class FileSystemColliderProcessor : IColliderProcessor
{
    private const string ColliderFileName = "collider.json";
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly IGltfVertexReader vertexReader;
    private readonly IConvexHullBuilder hullBuilder;

    /// <summary>
    /// Inizializza il processore con i componenti geometrici vincolati.
    /// </summary>
    public FileSystemColliderProcessor(IGltfVertexReader vertexReader, IConvexHullBuilder hullBuilder)
    {
        this.vertexReader = vertexReader;
        this.hullBuilder = hullBuilder;
    }

    /// <inheritdoc />
    public async Task<ColliderProcessingResult> ProcessAsync(
        string holdId,
        string modelPath,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(holdId);
        ArgumentException.ThrowIfNullOrWhiteSpace(modelPath);

        var sourceHash = await ComputeHashAsync(modelPath, cancellationToken);
        var colliderPath = Path.Combine(Path.GetDirectoryName(modelPath)!, ColliderFileName);
        if (await HasMatchingColliderAsync(colliderPath, sourceHash, cancellationToken))
        {
            return ColliderProcessingResult.Reused;
        }

        cancellationToken.ThrowIfCancellationRequested();
        var vertices = vertexReader.ReadVertices(modelPath);
        var geometry = hullBuilder.Build(vertices);
        ValidateGeometry(geometry);

        var document = new ColliderDocument(sourceHash, geometry.Vertices, geometry.Indices);
        await WriteAtomicallyAsync(colliderPath, document, cancellationToken);
        return ColliderProcessingResult.Generated;
    }

    /// <summary>
    /// Calcola SHA-256 direttamente dallo stream del modello.
    /// </summary>
    private static async Task<string> ComputeHashAsync(string modelPath, CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(
            modelPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 81920,
            useAsync: true);
        var hash = await SHA256.HashDataAsync(stream, cancellationToken);
        return $"sha256:{Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    /// <summary>
    /// Verifica hash e schema minimo del collider esistente senza usare timestamp.
    /// </summary>
    private static async Task<bool> HasMatchingColliderAsync(
        string colliderPath,
        string sourceHash,
        CancellationToken cancellationToken)
    {
        if (!File.Exists(colliderPath))
        {
            return false;
        }

        try
        {
            await using var stream = File.OpenRead(colliderPath);
            var document = await JsonSerializer.DeserializeAsync<ColliderDocument>(stream, JsonOptions, cancellationToken);
            return document is not null
                && document.SourceHash == sourceHash
                && IsValidGeometry(document.Vertices, document.Indices);
        }
        catch (JsonException)
        {
            return false;
        }
        catch (IOException)
        {
            return false;
        }
    }

    /// <summary>
    /// Impedisce la persistenza di geometrie non utilizzabili da Rapier.
    /// </summary>
    private static void ValidateGeometry(ConvexHullGeometry geometry)
    {
        if (!IsValidGeometry(geometry.Vertices, geometry.Indices))
        {
            throw new InvalidDataException("La geometria Convex Hull generata non e valida.");
        }
    }

    /// <summary>
    /// Valida cardinalita, finitezza e intervallo degli indici triangolari.
    /// </summary>
    private static bool IsValidGeometry(double[]? vertices, int[]? indices)
    {
        if (vertices is null || indices is null || vertices.Length < 12 || vertices.Length % 3 != 0
            || indices.Length < 12 || indices.Length % 3 != 0 || vertices.Any(value => !double.IsFinite(value)))
        {
            return false;
        }

        var vertexCount = vertices.Length / 3;
        return indices.All(index => index >= 0 && index < vertexCount);
    }

    /// <summary>
    /// Scrive prima su un file temporaneo e sostituisce il collider solo a documento completo.
    /// </summary>
    private static async Task WriteAtomicallyAsync(
        string colliderPath,
        ColliderDocument document,
        CancellationToken cancellationToken)
    {
        var temporaryPath = $"{colliderPath}.{Guid.NewGuid():N}.tmp";
        try
        {
            await using (var stream = new FileStream(
                temporaryPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true))
            {
                await JsonSerializer.SerializeAsync(stream, document, JsonOptions, cancellationToken);
            }

            File.Move(temporaryPath, colliderPath, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }
}
