using Microsoft.AspNetCore.Mvc;

namespace TheRouteSetter.Api.Controllers;

/// <summary>
/// Espone le informazioni minime per verificare la disponibilita del backend.
/// </summary>
[ApiController]
[Route("api/system")]
public sealed class SystemController : ControllerBase
{
    /// <summary>
    /// Restituisce lo stato corrente del processo API.
    /// </summary>
    /// <returns>Uno stato utilizzabile dai controlli di disponibilita.</returns>
    [HttpGet("health")]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> GetHealth() => Ok(new HealthResponse("Healthy"));
}

/// <summary>
/// Rappresenta lo stato sintetico del backend.
/// </summary>
/// <param name="Status">Stato corrente del processo.</param>
public sealed record HealthResponse(string Status);
