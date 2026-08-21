using Microsoft.AspNetCore.Mvc;
using TheRouteSetter.Api.Contracts;
using TheRouteSetter.Api.Services;

namespace TheRouteSetter.Api.Controllers;

[ApiController]
[Route("api/wall")]
public sealed class WallController : ControllerBase
{
    private readonly AssetManifestService assetManifestService;

    public WallController(AssetManifestService assetManifestService)
    {
        this.assetManifestService = assetManifestService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(WallResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponseDto), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<WallResponseDto>> GetWall(CancellationToken cancellationToken)
    {
        WallResponseDto? wall = await assetManifestService.GetWallAsync(cancellationToken);
        if (wall is null)
        {
            return NotFound();
        }

        return Ok(wall);
    }
}
