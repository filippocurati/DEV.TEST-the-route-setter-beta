using Microsoft.AspNetCore.Mvc;
using TheRouteSetter.Api.Models;
using TheRouteSetter.Api.Services.Logging;

namespace TheRouteSetter.Api.Controllers;

/// <summary>
/// Riceve gli eventi diagnostici essenziali prodotti dal frontend.
/// </summary>
[ApiController]
[Route("api/logs")]
public sealed class LogsController : ControllerBase
{
    private readonly IFrontendLogService logs;

    /// <summary>
    /// Inizializza il controller con il servizio di logging frontend.
    /// </summary>
    public LogsController(IFrontendLogService logs)
    {
        this.logs = logs;
    }

    /// <summary>
    /// Accetta un evento diagnostico da registrare lato server.
    /// </summary>
    /// <response code="202">Evento accettato dal backend.</response>
    /// <response code="400">Payload non valido.</response>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult Post([FromBody] FrontendLogRequest request)
    {
        if (request.Level == LogLevel.None)
        {
            ModelState.AddModelError(nameof(request.Level), "Il livello None non e accettato.");
            return ValidationProblem(ModelState);
        }

        if (request.Context is { Count: > 20 })
        {
            ModelState.AddModelError(nameof(request.Context), "Sono consentite al massimo 20 proprieta di contesto.");
            return ValidationProblem(ModelState);
        }

        logs.Write(request, HttpContext.TraceIdentifier);
        return Accepted();
    }
}
