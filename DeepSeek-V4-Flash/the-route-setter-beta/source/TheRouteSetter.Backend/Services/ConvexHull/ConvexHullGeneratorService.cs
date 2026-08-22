using System.Security.Cryptography;
using System.Text.Json;
using SharpGLTF.Schema2;
using MIConvexHull;
using TheRouteSetter.Backend.Models;

namespace TheRouteSetter.Backend.Services.ConvexHull;

/// <summary>
/// Servizio per la generazione e la gestione dei collider Convex Hull delle prese.
/// Utilizza SharpGLTF per il parsing dei modelli GLB e MIConvexHull per il calcolo dell'inviluppo convesso.
/// </summary>
public class ConvexHullGeneratorService
{
    private readonly ILogger<ConvexHullGeneratorService> _logger;

    /// <summary>
    /// Inizializza il servizio di generazione ConvexHull.
    /// </summary>
    public ConvexHullGeneratorService(ILogger<ConvexHullGeneratorService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Genera o recupera il collider per una presa. Se il collider esiste già ed è coerente con il GLB, lo riutilizza.
    /// </summary>
    /// <param name="holdDir">Percorso completo della cartella della presa.</param>
    /// <param name="glbFile">Percorso completo del file GLB.</param>
    /// <returns>Il ColliderData generato o null se il GLB non è valido.</returns>
    public ColliderData? GenerateOrGetCollider(string holdDir, string glbFile)
    {
        var colliderPath = Path.Combine(holdDir, "collider.json");
        var currentHash = ComputeFileHash(glbFile);

        if (File.Exists(colliderPath))
        {
            try
            {
                var existing = JsonSerializer.Deserialize<ColliderData>(
                    File.ReadAllBytes(colliderPath));

                if (existing != null && existing.SourceHash == currentHash)
                {
                    _logger.LogInformation("Collider per {GlbFile} già presente e coerente, riutilizzato.", glbFile);
                    return existing;
                }

                _logger.LogInformation("Hash modificato per {GlbFile}, rigenerazione collider.", glbFile);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Errore lettura collider esistente per {GlbFile}, rigenerazione.", glbFile);
            }
        }

        return GenerateCollider(glbFile, colliderPath, currentHash);
    }

    /// <summary>
    /// Genera il collider Convex Hull dal file GLB e lo salva su disco.
    /// </summary>
    private ColliderData? GenerateCollider(string glbFile, string colliderPath, string sourceHash)
    {
        try
        {
            _logger.LogInformation("Generazione collider per {GlbFile}...", glbFile);

            var model = ModelRoot.Load(glbFile);
            var vertices = ExtractVertices(model);

            if (vertices.Count < 3)
            {
                _logger.LogWarning("Numero insufficiente di vertici ({Count}) per {GlbFile}", vertices.Count, glbFile);
                return null;
            }

            var hullVertices = ComputeConvexHull(vertices);
            if (hullVertices == null || hullVertices.Count < 3)
            {
                _logger.LogWarning("Convex Hull non valido per {GlbFile}", glbFile);
                return null;
            }

            var flatVertices = new float[hullVertices.Count * 3];
            for (int i = 0; i < hullVertices.Count; i++)
            {
                flatVertices[i * 3] = hullVertices[i].X;
                flatVertices[i * 3 + 1] = hullVertices[i].Y;
                flatVertices[i * 3 + 2] = hullVertices[i].Z;
            }

            var collider = new ColliderData
            {
                SourceHash = sourceHash,
                Vertices = flatVertices,
                Indices = null
            };

            var json = JsonSerializer.Serialize(collider, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(colliderPath, json);

            _logger.LogInformation("Collider generato e salvato in {ColliderPath}", colliderPath);
            return collider;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Errore durante la generazione del collider per {GlbFile}", glbFile);
            return null;
        }
    }

    /// <summary>
    /// Estrae tutti i vertici unici dalla mesh GLB.
    /// </summary>
    private static List<Vec3> ExtractVertices(ModelRoot model)
    {
        var uniqueVertices = new HashSet<Vec3>();

        foreach (var node in model.DefaultScene.VisualChildren)
        {
            var mesh = node.Mesh;
            if (mesh == null) continue;

            foreach (var primitive in mesh.Primitives)
            {
                var positions = primitive.GetVertexAccessor("POSITION");
                if (positions == null) continue;

                for (int i = 0; i < positions.Count; i++)
                {
                    var pos = positions[i];
                    uniqueVertices.Add(new Vec3(
                        (float)pos[0],
                        (float)pos[1],
                        (float)pos[2]
                    ));
                }
            }
        }

        return uniqueVertices.ToList();
    }

    /// <summary>
    /// Calcola l'inviluppo convesso dai vertici usando MIConvexHull.
    /// </summary>
    private static List<Vertex3D>? ComputeConvexHull(List<Vec3> vertices)
    {
        var vertices3D = vertices.Select(v => new Vertex3D(v.X, v.Y, v.Z)).ToArray();
        var hull = ConvexHull<Vertex3D, DefaultConvexFace<Vertex3D>>.Create(vertices3D);
        return hull?.Points.ToList();
    }

    /// <summary>
    /// Calcola l'hash SHA256 del contenuto di un file.
    /// </summary>
    private static string ComputeFileHash(string filePath)
    {
        using var sha256 = SHA256.Create();
        using var stream = File.OpenRead(filePath);
        var hash = sha256.ComputeHash(stream);
        return "sha256:" + Convert.ToHexStringLower(hash);
    }

    /// <summary>
    /// Struttura 3D interna per i vertici.
    /// </summary>
    private readonly struct Vec3 : IEquatable<Vec3>
    {
        public float X { get; }
        public float Y { get; }
        public float Z { get; }

        public Vec3(float x, float y, float z) { X = x; Y = y; Z = z; }

        public bool Equals(Vec3 other) => X == other.X && Y == other.Y && Z == other.Z;
        public override int GetHashCode() => HashCode.Combine(X, Y, Z);
    }

    /// <summary>
    /// Vertice 3D per MIConvexHull.
    /// </summary>
    private class Vertex3D : IVector3
    {
        public double X { get; }
        public double Y { get; }
        public double Z { get; }

        public Vertex3D(double x, double y, double z) { X = x; Y = y; Z = z; }
    }
}