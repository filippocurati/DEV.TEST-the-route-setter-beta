using System.Numerics;
using SharpGLTF.Schema2;

namespace TheRouteSetter.Api.Services.ConvexHull;

/// <summary>
/// Legge le posizioni delle mesh GLB tramite SharpGLTF.
/// </summary>
public sealed class SharpGltfVertexReader : IGltfVertexReader
{
    /// <inheritdoc />
    public IReadOnlyList<Vector3> ReadVertices(string modelPath)
    {
        var model = ModelRoot.Load(modelPath);
        var meshNodes = model.LogicalNodes.Where(node => node.Mesh is not null).ToArray();
        var vertices = meshNodes
            .SelectMany(node => node.Mesh!.Primitives.Select(primitive => (primitive, node.WorldMatrix)))
            .Select(item => (accessor: item.primitive.GetVertexAccessor("POSITION"), item.WorldMatrix))
            .Where(item => item.accessor is not null)
            .SelectMany(item => item.accessor!.AsVector3Array().Select(vertex => Vector3.Transform(vertex, item.WorldMatrix)))
            .Where(IsFinite)
            .Distinct()
            .ToArray();

        if (vertices.Length < 4)
        {
            throw new InvalidDataException("Il modello deve contenere almeno quattro vertici tridimensionali validi.");
        }

        return vertices;
    }

    /// <summary>
    /// Verifica che una posizione non contenga valori non numerici o infiniti.
    /// </summary>
    private static bool IsFinite(Vector3 vertex) =>
        float.IsFinite(vertex.X) && float.IsFinite(vertex.Y) && float.IsFinite(vertex.Z);
}
