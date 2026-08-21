using System.Numerics;
using TheRouteSetter.Api.Services.ConvexHull;
using Xunit;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica le integrazioni reali con MIConvexHull e SharpGLTF.
/// </summary>
public sealed class ConvexHullGeometryTests
{
    /// <summary>
    /// Verifica che MIConvexHull elimini un punto interno e produca quattro facce triangolari.
    /// </summary>
    [Fact]
    public void MiConvexHullBuilder_CreatesTetrahedronFromPoints()
    {
        var builder = new MiConvexHullBuilder();

        var geometry = builder.Build([
            Vector3.Zero,
            Vector3.UnitX,
            Vector3.UnitY,
            Vector3.UnitZ,
            new Vector3(0.1f, 0.1f, 0.1f)
        ]);

        Assert.Equal(12, geometry.Vertices.Length);
        Assert.Equal(12, geometry.Indices.Length);
        Assert.All(geometry.Indices, index => Assert.InRange(index, 0, 3));
    }

    /// <summary>
    /// Verifica che SharpGLTF estragga vertici finiti da un GLB reale del catalogo.
    /// </summary>
    [Fact]
    public void SharpGltfVertexReader_ReadsRealHoldModel()
    {
        var reader = new SharpGltfVertexReader();
        var modelPath = FindRepositoryFile("holds", "Hold1", "hold1.glb");

        var vertices = reader.ReadVertices(modelPath);

        Assert.True(vertices.Count >= 4);
        Assert.All(vertices, vertex =>
        {
            Assert.True(float.IsFinite(vertex.X));
            Assert.True(float.IsFinite(vertex.Y));
            Assert.True(float.IsFinite(vertex.Z));
        });
    }

    /// <summary>
    /// Risale dalla directory binaria dei test fino alla radice del repository.
    /// </summary>
    private static string FindRepositoryFile(params string[] relativeSegments)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "app_definition.md")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        var segments = new[] { directory!.FullName }.Concat(relativeSegments).ToArray();
        var path = Path.Combine(segments);
        Assert.True(File.Exists(path), $"Asset di test non trovato: {path}");
        return path;
    }
}
