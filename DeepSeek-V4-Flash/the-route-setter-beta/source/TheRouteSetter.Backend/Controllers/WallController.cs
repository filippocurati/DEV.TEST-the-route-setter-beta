using Microsoft.AspNetCore.Mvc;
using TheRouteSetter.Backend.Models;
using TheRouteSetter.Backend.Services.Wall;

namespace TheRouteSetter.Backend.Controllers;

/// <summary>
/// Controller per le operazioni relative alla parete principale.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class WallController : ControllerBase
{
    private readonly WallService _wallService;

    /// <summary>
    /// Inizializza il controller con il servizio parete.
    /// </summary>
    public WallController(WallService wallService)
    {
        _wallService = wallService;
    }

    /// <summary>
    /// Recupera le informazioni sulla parete principale, incluso l'URL del modello 3D.
    /// </summary>
    /// <returns>Informazioni sulla parete con URL del modello GLB.</returns>
    /// <response code="200">Restituisce le informazioni sulla parete.</response>
    [HttpGet]
    [ProducesResponseType(typeof(WallInfo), StatusCodes.Status200OK)]
    public IActionResult GetWall()
    {
        var wallInfo = _wallService.GetWallInfo();
        return Ok(wallInfo);
    }
}