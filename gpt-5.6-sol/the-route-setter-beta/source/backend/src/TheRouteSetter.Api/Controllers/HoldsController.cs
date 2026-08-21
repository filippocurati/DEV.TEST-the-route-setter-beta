using Microsoft.AspNetCore.Mvc;
using TheRouteSetter.Api.Models;
using TheRouteSetter.Api.Services.Assets;

namespace TheRouteSetter.Api.Controllers;

/// <summary>
/// Espone il manifest e i file statici delle prese valide.
/// </summary>
[ApiController]
[Route("api/holds")]
public sealed class HoldsController : ControllerBase
{
    private readonly IAssetCatalogService assets;

    /// <summary>
    /// Inizializza il controller con il servizio di discovery asset.
    /// </summary>
    public HoldsController(IAssetCatalogService assets)
    {
        this.assets = assets;
    }

    /// <summary>
    /// Restituisce il catalogo leggero senza includere i modelli GLB.
    /// </summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<HoldManifest>>(StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<HoldManifest>> GetAll() => Ok(assets.GetHolds());

    /// <summary>
    /// Scarica su richiesta il modello GLB della presa indicata.
    /// </summary>
    [HttpGet("{id}/model")]
    [Produces("model/gltf-binary")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetModel(string id) => ToFileResult(assets.GetHoldModel(id));

    /// <summary>
    /// Scarica l'immagine di anteprima della presa indicata.
    /// </summary>
    [HttpGet("{id}/preview")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetPreview(string id) => ToFileResult(assets.GetHoldPreview(id));

    /// <summary>
    /// Scarica il collider pre-calcolato quando disponibile.
    /// </summary>
    [HttpGet("{id}/collider")]
    [Produces("application/json")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetCollider(string id) => ToFileResult(assets.GetHoldCollider(id));

    /// <summary>
    /// Scarica un asset opzionale scoperto nella cartella della presa.
    /// </summary>
    [HttpGet("{id}/assets/{fileName}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetOptionalAsset(string id, string fileName) =>
        ToFileResult(assets.GetHoldOptionalAsset(id, fileName));

    /// <summary>
    /// Converte un asset disponibile in una risposta file con supporto alle richieste range.
    /// </summary>
    private IActionResult ToFileResult(AssetFile? asset) => asset is null
        ? NotFound()
        : PhysicalFile(asset.Path, asset.ContentType, enableRangeProcessing: true);
}
