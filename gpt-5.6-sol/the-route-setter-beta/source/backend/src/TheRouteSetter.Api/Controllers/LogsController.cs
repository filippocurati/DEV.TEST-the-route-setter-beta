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
    [RequestSizeLimit(32768)]
    [ProducesResponseType<FrontendLogResponse>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status415UnsupportedMediaType)]
    public IActionResult Post([FromBody] FrontendLogRequest request)
    {
        if (request.Level is null || !Enum.IsDefined(request.Level.Value) || request.Level == LogLevel.None)
        {
            ModelState.AddModelError(nameof(request.Level), "Il livello None non e accettato.");
            return ValidationProblem(ModelState);
        }

        if (request.Context is { Count: > 20 }
            || request.Context?.Any(item => item.Key.Length > 80 || item.Value is null || item.Value.Length > 500) == true
            || request.RequestId is { Length: 0 }
            || (request.ErrorId is not null && !Guid.TryParse(request.ErrorId, out _)))
        {
            ModelState.AddModelError(nameof(request.Context), "Sono consentite al massimo 20 proprieta di contesto.");
            return ValidationProblem(ModelState);
        }

        return Accepted(logs.Write(request, HttpContext.TraceIdentifier));
    }
}
