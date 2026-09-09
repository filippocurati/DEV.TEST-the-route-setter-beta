namespace TheRouteSetter.Api.Services.Assets;

/// <summary>Materializza l'enumerazione nel confine di isolamento I/O della discovery.</summary>
public class AssetDirectoryReader
{
    /// <summary>Elenca le sottocartelle immediate.</summary>
    public virtual string[] GetDirectories(string path) => Directory.GetDirectories(path);

    /// <summary>Elenca i file immediati senza leggerne il contenuto.</summary>
    public virtual string[] GetFiles(string path) => Directory.GetFiles(path);
}
