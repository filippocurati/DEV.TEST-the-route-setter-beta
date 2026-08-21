using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using MIConvexHull;
using SharpGLTF.Schema2;

namespace TheRouteSetter.Application.ConvexHull;

public sealed class ColliderGenerationService : IColliderGenerationService
{
    private static readonly JsonSerializerOptions JsonSerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public async Task<ColliderGenerationResult> EnsureColliderAsync(
        string modelAbsolutePath,
        string colliderAbsolutePath,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        string sourceHash = await ComputeSourceHashAsync(modelAbsolutePath, cancellationToken);
        ColliderDocument? existingCollider = await TryReadColliderAsync(colliderAbsolutePath, cancellationToken);

        if (existingCollider is not null && string.Equals(existingCollider.SourceHash, sourceHash, StringComparison.Ordinal))
        {
            return new ColliderGenerationResult(colliderAbsolutePath, false, sourceHash);
        }

        ColliderDocument colliderDocument = BuildColliderDocument(modelAbsolutePath, sourceHash);

        string? colliderDirectory = Path.GetDirectoryName(colliderAbsolutePath);
        if (!string.IsNullOrWhiteSpace(colliderDirectory))
        {
            Directory.CreateDirectory(colliderDirectory);
        }

        await using FileStream writeStream = File.Create(colliderAbsolutePath);
        await JsonSerializer.SerializeAsync(writeStream, colliderDocument, JsonSerializerOptions, cancellationToken);

        return new ColliderGenerationResult(colliderAbsolutePath, true, sourceHash);
    }

    public async Task<bool> IsColliderCoherentAsync(
        string modelAbsolutePath,
        string colliderAbsolutePath,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!File.Exists(colliderAbsolutePath))
        {
            return false;
        }

        ColliderDocument? colliderDocument = await TryReadColliderAsync(colliderAbsolutePath, cancellationToken);
        if (!IsValidDocument(colliderDocument))
        {
            return false;
        }

        string sourceHash = await ComputeSourceHashAsync(modelAbsolutePath, cancellationToken);
        return string.Equals(colliderDocument!.SourceHash, sourceHash, StringComparison.Ordinal);
    }

    private static async Task<ColliderDocument?> TryReadColliderAsync(string colliderAbsolutePath, CancellationToken cancellationToken)
    {
        if (!File.Exists(colliderAbsolutePath))
        {
            return null;
        }

        try
        {
            await using FileStream readStream = File.OpenRead(colliderAbsolutePath);
            return await JsonSerializer.DeserializeAsync<ColliderDocument>(readStream, JsonSerializerOptions, cancellationToken);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool IsValidDocument(ColliderDocument? document)
    {
        if (document is null)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(document.SourceHash))
        {
            return false;
        }

        if (document.Vertices is null || document.Vertices.Count < 12 || document.Vertices.Count % 3 != 0)
        {
            return false;
        }

        if (document.Indices is not null && document.Indices.Count % 3 != 0)
        {
            return false;
        }

        return true;
    }

    private static ColliderDocument BuildColliderDocument(string modelAbsolutePath, string sourceHash)
    {
        IReadOnlyList<double[]> vertices = ReadVerticesFromGlb(modelAbsolutePath);
        if (vertices.Count < 4)
        {
            throw new InvalidOperationException($"Il modello '{modelAbsolutePath}' non contiene abbastanza vertici per un inviluppo convesso.");
        }

        ConvexHullCreationResult<VertexNode, FaceNode> hullCreationResult = MIConvexHull.ConvexHull.Create<VertexNode, FaceNode>(
            vertices.Select(static vertex => new VertexNode(vertex[0], vertex[1], vertex[2])).ToList());

        if (hullCreationResult.Outcome != ConvexHullCreationResultOutcome.Success)
        {
            throw new InvalidOperationException($"Impossibile generare convex hull: {hullCreationResult.ErrorMessage}");
        }

        MIConvexHull.ConvexHull<VertexNode, FaceNode> hull = hullCreationResult.Result;

        List<double> flattenedVertices = hull.Points
            .SelectMany(static point => point.Position)
            .ToList();

        IReadOnlyDictionary<VertexNode, int> vertexIndexes = hull.Points
            .Select((vertex, index) => new { vertex, index })
            .ToDictionary(static tuple => tuple.vertex, static tuple => tuple.index);

        List<int> indices = new();
        foreach (FaceNode face in hull.Faces)
        {
            if (face.Vertices is null || face.Vertices.Length < 3)
            {
                continue;
            }

            int baseVertexIndex = vertexIndexes[face.Vertices[0]];
            for (int i = 1; i < face.Vertices.Length - 1; i++)
            {
                indices.Add(baseVertexIndex);
                indices.Add(vertexIndexes[face.Vertices[i]]);
                indices.Add(vertexIndexes[face.Vertices[i + 1]]);
            }
        }

        IReadOnlyList<int>? optionalIndices = indices.Count == 0 ? null : indices;

        return new ColliderDocument(sourceHash, flattenedVertices, optionalIndices);
    }

    private static IReadOnlyList<double[]> ReadVerticesFromGlb(string modelAbsolutePath)
    {
        ModelRoot model = ModelRoot.Load(modelAbsolutePath);

        List<double[]> vertices = new();
        foreach (SharpGLTF.Schema2.Mesh mesh in model.LogicalMeshes)
        {
            foreach (MeshPrimitive primitive in mesh.Primitives)
            {
                if (!primitive.VertexAccessors.TryGetValue("POSITION", out Accessor? positionAccessor) || positionAccessor is null)
                {
                    continue;
                }

                foreach (System.Numerics.Vector3 position in positionAccessor.AsVector3Array())
                {
                    vertices.Add([
                        Convert.ToDouble(position.X, CultureInfo.InvariantCulture),
                        Convert.ToDouble(position.Y, CultureInfo.InvariantCulture),
                        Convert.ToDouble(position.Z, CultureInfo.InvariantCulture)
                    ]);
                }
            }
        }

        return vertices;
    }

    private static async Task<string> ComputeSourceHashAsync(string modelAbsolutePath, CancellationToken cancellationToken)
    {
        await using FileStream readStream = File.OpenRead(modelAbsolutePath);
        byte[] hashBytes = await SHA256.HashDataAsync(readStream, cancellationToken);
        return $"sha256:{Convert.ToHexString(hashBytes).ToLowerInvariant()}";
    }

    private sealed class VertexNode : IVertex
    {
        public VertexNode(double x, double y, double z)
        {
            Position = [x, y, z];
        }

        public double[] Position { get; }
    }

    private sealed class FaceNode : ConvexFace<VertexNode, FaceNode>
    {
    }
}
