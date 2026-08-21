namespace TheRouteSetter.Api.Services.Assets;

/// <summary>
/// Configura la posizione delle cartelle statiche esterne ai sorgenti.
/// </summary>
public sealed class AssetStorageOptions
{
    /// <summary>
    /// Nome della sezione di configurazione.
    /// </summary>
    public const string SectionName = "AssetStorage";

    /// <summary>
    /// Percorso della radice che contiene le cartelle degli asset.
    /// </summary>
    public string RootPath { get; init; } = "../../../../";

    /// <summary>
    /// Nome della cartella che contiene la parete principale.
    /// </summary>
    public string MainWallDirectory { get; init; } = "main-wall";

    /// <summary>
    /// Nome della cartella che contiene le prese.
    /// </summary>
    public string HoldsDirectory { get; init; } = "holds";
}
