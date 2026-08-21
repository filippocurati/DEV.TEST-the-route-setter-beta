using Microsoft.AspNetCore.Mvc;
using TheRouteSetter.Api.Contracts;

namespace TheRouteSetter.Api.Controllers;

[ApiController]
[Route("api/logs")]
public sealed class LogsController : ControllerBase
{
    private readonly ILogger<LogsController> logger;

    public LogsController(ILogger<LogsController> logger)
    {
        this.logger = logger;
    }

    [HttpPost]
    [ProducesResponseType(typeof(FrontendLogResponseDto), StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public ActionResult<FrontendLogResponseDto> PostLog([FromBody] FrontendLogRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest();
        }

        string logId = Guid.NewGuid().ToString("N");
        logger.LogInformation(
            "Frontend log accepted {LogId} {Level} {Category} {Message}",
            logId,
            request.Level,
            request.Category,
            request.Message);

        return Accepted(new FrontendLogResponseDto(logId, "accepted"));
    }
}
