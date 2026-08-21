using Microsoft.AspNetCore.Mvc;
using TheRouteSetter.Backend.Models;
using TheRouteSetter.Backend.Services.Catalog;

namespace TheRouteSetter.Backend.Controllers;

/// <summary>
/// Controller per la gestione del catalogo delle prese.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class HoldsController : ControllerBase
{
    private readonly HoldDiscoveryService _holdDiscovery;

    /// <summary>
    /// Inizializza il controller con il servizio di scoperta delle prese.
    /// </summary>
    public HoldsController(HoldDiscoveryService holdDiscovery)
    {
        _holdDiscovery = holdDiscovery;
    }

    /// <summary>
    /// Restituisce il catalogo completo delle prese disponibili.
    /// </summary>
    /// <returns>Elenco di manifest delle prese con URL per anteprima, modello e collider.</returns>
    /// <response code="200">Restituisce l'elenco delle prese.</response>
    [HttpGet]
    [ProducesResponseType(typeof(List<HoldManifest>), StatusCodes.Status200OK)]
    public IActionResult GetHolds()
    {
        var holds = _holdDiscovery.DiscoverHolds();
        return Ok(holds);
    }

    /// <summary>
    /// Restituisce l'URL del modello GLB per una presa specifica.
    /// </summary>
    /// <param name="id">Identificativo della presa (es. Hold1).</param>
    /// <returns>URL del modello GLB.</returns>
    /// <response code="200">Restituisce l'URL del modello.</response>
    /// <response code="404">Presa non trovata.</response>
    [HttpGet("{id}/model")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public IActionResult GetHoldModel(string id)
    {
        var holds = _holdDiscovery.DiscoverHolds();
        var hold = holds.FirstOrDefault(h =>
            h.Id.Equals(id, StringComparison.OrdinalIgnoreCase));

        if (hold == null)
        {
            return NotFound(new ErrorResponse
            {
                ErrorId = Guid.NewGuid().ToString(),
                Message = $"Presa '{id}' non trovata nel catalogo."
            });
        }

        return Ok(new { modelUrl = hold.ModelUrl });
    }

    /// <summary>
    /// Restituisce l'URL del collider per una presa specifica.
    /// </summary>
    /// <param name="id">Identificativo della presa (es. Hold1).</param>
    /// <returns>URL del file collider.</returns>
    /// <response code="200">Restituisce l'URL del collider.</response>
    /// <response code="404">Presa non trovata o collider non ancora generato.</response>
    [HttpGet("{id}/collider")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public IActionResult GetHoldCollider(string id)
    {
        var holds = _holdDiscovery.DiscoverHolds();
        var hold = holds.FirstOrDefault(h =>
            h.Id.Equals(id, StringComparison.OrdinalIgnoreCase));

        if (hold == null)
        {
            return NotFound(new ErrorResponse
            {
                ErrorId = Guid.NewGuid().ToString(),
                Message = $"Presa '{id}' non trovata nel catalogo."
            });
        }

        if (!hold.ColliderReady)
        {
            return NotFound(new ErrorResponse
            {
                ErrorId = Guid.NewGuid().ToString(),
                Message = $"Collider per la presa '{id}' non ancora disponibile."
            });
        }

        return Ok(new { colliderUrl = hold.ColliderUrl });
    }
}