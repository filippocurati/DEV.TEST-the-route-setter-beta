using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using TheRouteSetter.Api.Services.Assets;

namespace TheRouteSetter.Api.Controllers;

/// <summary>
/// Espone il modello statico della parete principale.
/// </summary>
[ApiController]
[Route("api/wall")]
public sealed class WallController : ControllerBase
{
    private readonly IAssetCatalogService assets;

    /// <summary>
    /// Inizializza il controller con il servizio di discovery asset.
    /// </summary>
    public WallController(IAssetCatalogService assets)
    {
        this.assets = assets;
    }

    /// <summary>
    /// Scarica il modello GLB della parete configurata.
    /// </summary>
    /// <response code="200">Il modello della parete.</response>
    /// <response code="404">Nessun modello parete disponibile.</response>
    [HttpGet]
    [Produces("model/gltf-binary")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult Get()
    {
        var asset = assets.GetWall();
        if (asset is null)
        {
            return NotFound();
        }

        var fileName = Path.GetFileName(asset.Path);
        var disposition = new ContentDispositionHeaderValue("inline")
        {
            FileName = fileName,
            FileNameStar = fileName
        };
        Response.Headers.ContentDisposition = disposition.ToString();
        return PhysicalFile(asset.Path, asset.ContentType, enableRangeProcessing: true);
    }
}
