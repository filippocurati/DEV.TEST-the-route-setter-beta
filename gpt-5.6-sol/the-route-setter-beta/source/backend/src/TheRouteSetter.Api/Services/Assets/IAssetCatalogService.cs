using TheRouteSetter.Api.Models;

namespace TheRouteSetter.Api.Services.Assets;

/// <summary>
/// Definisce la discovery e l'accesso controllato agli asset statici.
/// </summary>
public interface IAssetCatalogService
{
    /// <summary>
    /// Restituisce la parete principale, se presente.
    /// </summary>
    AssetFile? GetWall();

    /// <summary>
    /// Costruisce il manifest leggero delle prese valide.
    /// </summary>
    IReadOnlyList<HoldManifest> GetHolds();

    /// <summary>
    /// Restituisce i modelli validi da verificare o elaborare in background.
    /// </summary>
    IReadOnlyList<HoldModelAsset> GetHoldModels();

    /// <summary>
    /// Restituisce il modello GLB di una presa valida.
    /// </summary>
    AssetFile? GetHoldModel(string id);

    /// <summary>
    /// Restituisce l'anteprima di una presa valida, se presente.
    /// </summary>
    AssetFile? GetHoldPreview(string id);

    /// <summary>
    /// Restituisce il collider pre-calcolato di una presa valida, se presente.
    /// </summary>
    AssetFile? GetHoldCollider(string id);

    /// <summary>
    /// Restituisce un asset opzionale autorizzato di una presa valida.
    /// </summary>
    AssetFile? GetHoldOptionalAsset(string id, string fileName);
}
