using Microsoft.AspNetCore.Mvc;
using TheRouteSetter.Api.Contracts;
using TheRouteSetter.Api.Services;

namespace TheRouteSetter.Api.Controllers;

[ApiController]
[Route("api/holds")]
public sealed class HoldsController : ControllerBase
{
    private readonly AssetManifestService assetManifestService;

    public HoldsController(AssetManifestService assetManifestService)
    {
        this.assetManifestService = assetManifestService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<HoldManifestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponseDto), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<IReadOnlyList<HoldManifestDto>>> GetHolds(CancellationToken cancellationToken)
    {
        IReadOnlyList<HoldManifestDto> holds = await assetManifestService.GetHoldsAsync(cancellationToken);
        return Ok(holds);
    }

    [HttpGet("{id}/model")]
    [ProducesResponseType(typeof(AssetFileUrlDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponseDto), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<AssetFileUrlDto>> GetHoldModel(string id, CancellationToken cancellationToken)
    {
        string? modelUrl = await assetManifestService.GetHoldModelUrlAsync(id, cancellationToken);
        if (modelUrl is null)
        {
            return NotFound();
        }

        return Ok(new AssetFileUrlDto(modelUrl));
    }

    [HttpGet("{id}/collider")]
    [ProducesResponseType(typeof(AssetFileUrlDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiErrorResponseDto), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<AssetFileUrlDto>> GetHoldCollider(string id, CancellationToken cancellationToken)
    {
        string? colliderUrl = await assetManifestService.GetHoldColliderUrlAsync(id, cancellationToken);
        if (colliderUrl is null)
        {
            return NotFound();
        }

        return Ok(new AssetFileUrlDto(colliderUrl));
    }
}
