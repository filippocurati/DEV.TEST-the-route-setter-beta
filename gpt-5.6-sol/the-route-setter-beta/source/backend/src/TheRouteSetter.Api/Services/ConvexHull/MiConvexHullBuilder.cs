using System.Numerics;
using MIConvexHull;

namespace TheRouteSetter.Api.Services.ConvexHull;

/// <summary>
/// Calcola l'inviluppo convesso tridimensionale tramite MIConvexHull.
/// </summary>
public sealed class MiConvexHullBuilder : IConvexHullBuilder
{
    /// <inheritdoc />
    public ConvexHullGeometry Build(IReadOnlyList<Vector3> vertices)
    {
        var input = vertices
            .Select(vertex => new HullVertex(vertex))
            .ToArray();
        var creation = MIConvexHull.ConvexHull.Create<HullVertex, HullFace>(input, 1e-10);
        if (creation.Outcome != ConvexHullCreationResultOutcome.Success || creation.Result is null)
        {
            throw new InvalidDataException($"Impossibile generare l'inviluppo convesso: {creation.ErrorMessage}");
        }

        var hullVertices = creation.Result.Points
            .OrderBy(vertex => vertex.X)
            .ThenBy(vertex => vertex.Y)
            .ThenBy(vertex => vertex.Z)
            .ToArray();
        var vertexIndices = hullVertices
            .Select((vertex, index) => (vertex, index))
            .ToDictionary(item => item.vertex, item => item.index);
        var coordinates = hullVertices
            .SelectMany(vertex => new[] { vertex.X, vertex.Y, vertex.Z })
            .ToArray();
        var indices = creation.Result.Faces
            .Select(face => face.Vertices.Select(vertex => vertexIndices[vertex]).ToArray())
            .OrderBy(face => face.Min())
            .ThenBy(face => face[0])
            .ThenBy(face => face[1])
            .ThenBy(face => face[2])
            .SelectMany(face => face)
            .ToArray();

        return new ConvexHullGeometry(coordinates, indices);
    }

    /// <summary>
    /// Adatta una posizione numerica al contratto vertice di MIConvexHull.
    /// </summary>
    private sealed class HullVertex : IVertex
    {
        /// <summary>
        /// Inizializza il vertice dalla posizione GLB.
        /// </summary>
        public HullVertex(Vector3 position)
        {
            X = position.X;
            Y = position.Y;
            Z = position.Z;
            Position = [X, Y, Z];
        }

        /// <summary>
        /// Coordinata X usata per l'ordinamento deterministico.
        /// </summary>
        public double X { get; }

        /// <summary>
        /// Coordinata Y usata per l'ordinamento deterministico.
        /// </summary>
        public double Y { get; }

        /// <summary>
        /// Coordinata Z usata per l'ordinamento deterministico.
        /// </summary>
        public double Z { get; }

        /// <inheritdoc />
        public double[] Position { get; }
    }

    /// <summary>
    /// Rappresenta una faccia triangolare prodotta da MIConvexHull.
    /// </summary>
    private sealed class HullFace : ConvexFace<HullVertex, HullFace>;
}
