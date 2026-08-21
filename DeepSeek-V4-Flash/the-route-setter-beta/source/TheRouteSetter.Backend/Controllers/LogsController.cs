using Microsoft.AspNetCore.Mvc;
using TheRouteSetter.Backend.Models;
using TheRouteSetter.Backend.Services.Logging;

namespace TheRouteSetter.Backend.Controllers;

/// <summary>
/// Controller per la ricezione di eventi di log dal frontend.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class LogsController : ControllerBase
{
    private readonly LogReceiverService _logReceiver;

    /// <summary>
    /// Inizializza il controller con il servizio di ricezione log.
    /// </summary>
    public LogsController(LogReceiverService logReceiver)
    {
        _logReceiver = logReceiver;
    }

    /// <summary>
    /// Riceve un evento di log dal frontend e lo registra nel sistema di logging server-side.
    /// </summary>
    /// <param name="entry">Dati dell'evento di log.</param>
    /// <response code="200">Log ricevuto e registrato correttamente.</response>
    /// <response code="400">Dati del log non validi.</response>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public IActionResult PostLog([FromBody] LogEntry entry)
    {
        if (string.IsNullOrWhiteSpace(entry.Message))
        {
            return BadRequest(new ErrorResponse
            {
                ErrorId = Guid.NewGuid().ToString(),
                Message = "Il messaggio di log non può essere vuoto."
            });
        }

        _logReceiver.Log(entry);
        return Ok();
    }
}