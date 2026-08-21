using System.Text.Json;
using TheRouteSetter.Application.ConvexHull;

namespace TheRouteSetter.Hull.Tests;

public sealed class ColliderGenerationServiceTests : IDisposable
{
    private readonly string tempDirectory;
    private readonly IColliderGenerationService service;

    public ColliderGenerationServiceTests()
    {
        tempDirectory = Path.Combine(Path.GetTempPath(), "trs-hull-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDirectory);
        service = new ColliderGenerationService();
    }

    [Fact]
    public async Task GeneratesColliderWhenMissing()
    {
        string holdFolder = CreateHoldFolder("Hold1");
        string glbPath = Path.Combine(holdFolder, "hold.glb");
        string colliderPath = Path.Combine(holdFolder, "collider.json");

        CopyFixtureGlb("Hold1", "hold1.glb", glbPath);

        ColliderGenerationResult result = await service.EnsureColliderAsync(glbPath, colliderPath);

        Assert.True(result.WasRegenerated);
        Assert.True(File.Exists(colliderPath));

        ColliderDocument document = await ReadDocumentAsync(colliderPath);
        Assert.StartsWith("sha256:", document.SourceHash, StringComparison.Ordinal);
        Assert.True(document.Vertices.Count >= 12);
        Assert.True(document.Vertices.Count % 3 == 0);
        if (document.Indices is not null)
        {
            Assert.True(document.Indices.Count % 3 == 0);
        }
    }

    [Fact]
    public async Task ReusesColliderWhenHashMatches()
    {
        string holdFolder = CreateHoldFolder("Hold2");
        string glbPath = Path.Combine(holdFolder, "hold.glb");
        string colliderPath = Path.Combine(holdFolder, "collider.json");

        CopyFixtureGlb("Hold1", "hold1.glb", glbPath);

        ColliderGenerationResult firstRun = await service.EnsureColliderAsync(glbPath, colliderPath);
        DateTime firstWriteTime = File.GetLastWriteTimeUtc(colliderPath);

        await Task.Delay(50);

        ColliderGenerationResult secondRun = await service.EnsureColliderAsync(glbPath, colliderPath);
        DateTime secondWriteTime = File.GetLastWriteTimeUtc(colliderPath);

        Assert.True(firstRun.WasRegenerated);
        Assert.False(secondRun.WasRegenerated);
        Assert.Equal(firstWriteTime, secondWriteTime);
    }

    [Fact]
    public async Task RegeneratesColliderWhenGlbChanges()
    {
        string holdFolder = CreateHoldFolder("Hold3");
        string glbPath = Path.Combine(holdFolder, "hold.glb");
        string colliderPath = Path.Combine(holdFolder, "collider.json");

        CopyFixtureGlb("Hold1", "hold1.glb", glbPath);
        ColliderGenerationResult firstRun = await service.EnsureColliderAsync(glbPath, colliderPath);

        await Task.Delay(50);

        CopyFixtureGlb("Hold2", "hold2.glb", glbPath);
        ColliderGenerationResult secondRun = await service.EnsureColliderAsync(glbPath, colliderPath);

        Assert.True(firstRun.WasRegenerated);
        Assert.True(secondRun.WasRegenerated);
        Assert.NotEqual(firstRun.SourceHash, secondRun.SourceHash);
    }

    private static async Task<ColliderDocument> ReadDocumentAsync(string colliderPath)
    {
        await using FileStream stream = File.OpenRead(colliderPath);
        ColliderDocument? document = await JsonSerializer.DeserializeAsync<ColliderDocument>(stream, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(document);
        return document!;
    }

    private string CreateHoldFolder(string holdName)
    {
        string holdFolder = Path.Combine(tempDirectory, holdName);
        Directory.CreateDirectory(holdFolder);
        return holdFolder;
    }

    private void CopyFixtureGlb(string holdFolder, string fileName, string outputPath)
    {
        string repositoryRoot = FindRepositoryRoot();
        string fixturePath = Path.Combine(repositoryRoot, "holds", holdFolder, fileName);
        Assert.True(File.Exists(fixturePath), $"Fixture GLB non trovato: {fixturePath}");

        File.Copy(fixturePath, outputPath, true);
    }

    private static string FindRepositoryRoot()
    {
        DirectoryInfo? cursor = new(AppContext.BaseDirectory);
        while (cursor is not null)
        {
            string holdsFolder = Path.Combine(cursor.FullName, "holds");
            if (Directory.Exists(holdsFolder))
            {
                return cursor.FullName;
            }

            cursor = cursor.Parent;
        }

        throw new InvalidOperationException("Impossibile individuare la root del repository per i fixture GLB.");
    }

    public void Dispose()
    {
        if (Directory.Exists(tempDirectory))
        {
            Directory.Delete(tempDirectory, true);
        }
    }
}
