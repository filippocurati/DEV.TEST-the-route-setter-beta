using System.Numerics;
using System.Security.Cryptography;
using System.Text.Json;
using TheRouteSetter.Api.Services.ConvexHull;
using Xunit;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica generazione, riuso, invalidazione hash e schema persistito del collider.
/// </summary>
public sealed class ColliderProcessorTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), $"collider-tests-{Guid.NewGuid():N}");
    private readonly CountingVertexReader vertexReader = new();
    private readonly CountingHullBuilder hullBuilder = new();
    private readonly FileSystemColliderProcessor processor;

    /// <summary>
    /// Inizializza un modello temporaneo e un processore geometrico controllato.
    /// </summary>
    public ColliderProcessorTests()
    {
        Directory.CreateDirectory(directory);
        ModelPath = Path.Combine(directory, "hold.glb");
        File.WriteAllText(ModelPath, "MODEL-V1");
        processor = new FileSystemColliderProcessor(vertexReader, hullBuilder);
    }

    /// <summary>
    /// Percorso del modello temporaneo usato nel test.
    /// </summary>
    private string ModelPath { get; }

    /// <summary>
    /// Verifica che un collider mancante venga generato con hash, vertici e indici conformi.
    /// </summary>
    [Fact]
    public async Task MissingCollider_IsGeneratedWithValidSchema()
    {
        var result = await processor.ProcessAsync("Hold1", ModelPath, CancellationToken.None);
        var document = await ReadDocumentAsync();

        Assert.Equal(ColliderProcessingResult.Generated, result);
        Assert.Equal(1, vertexReader.CallCount);
        Assert.Equal(1, hullBuilder.CallCount);
        Assert.Equal(await ComputeExpectedHashAsync(), document.SourceHash);
        Assert.Equal(12, document.Vertices.Length);
        Assert.Equal(12, document.Indices.Length);
        Assert.All(document.Indices, index => Assert.InRange(index, 0, 3));
    }

    /// <summary>
    /// Verifica che hash uguale riutilizzi il file senza invocare la geometria.
    /// </summary>
    [Fact]
    public async Task MatchingCollider_IsReusedWithoutRegeneration()
    {
        await processor.ProcessAsync("Hold1", ModelPath, CancellationToken.None);
        var colliderPath = Path.Combine(directory, "collider.json");
        var originalBytes = await File.ReadAllBytesAsync(colliderPath);
        vertexReader.Reset();
        hullBuilder.Reset();

        var result = await processor.ProcessAsync("Hold1", ModelPath, CancellationToken.None);

        Assert.Equal(ColliderProcessingResult.Reused, result);
        Assert.Equal(0, vertexReader.CallCount);
        Assert.Equal(0, hullBuilder.CallCount);
        Assert.Equal(originalBytes, await File.ReadAllBytesAsync(colliderPath));
    }

    /// <summary>
    /// Verifica che una modifica del GLB determini la rigenerazione basata esclusivamente sul nuovo hash.
    /// </summary>
    [Fact]
    public async Task ChangedModel_RegeneratesColliderWithNewHash()
    {
        await processor.ProcessAsync("Hold1", ModelPath, CancellationToken.None);
        var previousHash = (await ReadDocumentAsync()).SourceHash;
        vertexReader.Reset();
        hullBuilder.Reset();
        await File.AppendAllTextAsync(ModelPath, "-CHANGED");

        var result = await processor.ProcessAsync("Hold1", ModelPath, CancellationToken.None);
        var updated = await ReadDocumentAsync();

        Assert.Equal(ColliderProcessingResult.Generated, result);
        Assert.NotEqual(previousHash, updated.SourceHash);
        Assert.Equal(await ComputeExpectedHashAsync(), updated.SourceHash);
        Assert.Equal(1, vertexReader.CallCount);
        Assert.Equal(1, hullBuilder.CallCount);
    }

    /// <summary>
    /// Verifica che un JSON malformato venga sostituito da un documento conforme.
    /// </summary>
    [Fact]
    public async Task InvalidColliderSchema_IsRegenerated()
    {
        await File.WriteAllTextAsync(Path.Combine(directory, "collider.json"), "{not-json}");

        var result = await processor.ProcessAsync("Hold1", ModelPath, CancellationToken.None);
        var document = await ReadDocumentAsync();

        Assert.Equal(ColliderProcessingResult.Generated, result);
        Assert.StartsWith("sha256:", document.SourceHash);
        Assert.NotEmpty(document.Vertices);
        Assert.NotEmpty(document.Indices);
    }

    /// <summary>
    /// Elimina i file temporanei creati dalla suite.
    /// </summary>
    public void Dispose()
    {
        if (Directory.Exists(directory))
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    /// <summary>
    /// Deserializza il collider generato con lo stesso contratto pubblico del backend.
    /// </summary>
    private async Task<ColliderDocument> ReadDocumentAsync()
    {
        await using var stream = File.OpenRead(Path.Combine(directory, "collider.json"));
        return (await JsonSerializer.DeserializeAsync<ColliderDocument>(stream))!;
    }

    /// <summary>
    /// Calcola indipendentemente l'hash atteso del modello temporaneo.
    /// </summary>
    private async Task<string> ComputeExpectedHashAsync()
    {
        await using var stream = File.OpenRead(ModelPath);
        var hash = await SHA256.HashDataAsync(stream);
        return $"sha256:{Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    /// <summary>
    /// Simula l'estrazione vertici e conta le elaborazioni geometriche effettive.
    /// </summary>
    private sealed class CountingVertexReader : IGltfVertexReader
    {
        /// <summary>
        /// Numero di letture eseguite.
        /// </summary>
        public int CallCount { get; private set; }

        /// <inheritdoc />
        public IReadOnlyList<Vector3> ReadVertices(string modelPath)
        {
            CallCount++;
            return [Vector3.Zero, Vector3.UnitX, Vector3.UnitY, Vector3.UnitZ];
        }

        /// <summary>
        /// Azzera il contatore tra due elaborazioni.
        /// </summary>
        public void Reset() => CallCount = 0;
    }

    /// <summary>
    /// Restituisce un tetraedro valido e conta le rigenerazioni.
    /// </summary>
    private sealed class CountingHullBuilder : IConvexHullBuilder
    {
        /// <summary>
        /// Numero di hull calcolati.
        /// </summary>
        public int CallCount { get; private set; }

        /// <inheritdoc />
        public ConvexHullGeometry Build(IReadOnlyList<Vector3> vertices)
        {
            CallCount++;
            return new ConvexHullGeometry(
                [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
                [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
        }

        /// <summary>
        /// Azzera il contatore tra due elaborazioni.
        /// </summary>
        public void Reset() => CallCount = 0;
    }
}
