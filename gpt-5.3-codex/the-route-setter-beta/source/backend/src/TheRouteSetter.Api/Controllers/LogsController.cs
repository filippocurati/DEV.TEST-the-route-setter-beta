using Microsoft.AspNetCore.Mvc;
using TheRouteSetter.Api.Contracts;
using TheRouteSetter.Api.Services;

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
    [ProducesResponseType(typeof(ApiErrorResponseDto), StatusCodes.Status500InternalServerError)]
    public ActionResult<FrontendLogResponseDto> PostLog([FromBody] FrontendLogRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Level) ||
            string.IsNullOrWhiteSpace(request.Category) ||
            string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest();
        }

        string logId = Guid.NewGuid().ToString("N");
        string sanitizedLevel = FrontendLogSanitizer.SanitizeText(request.Level);
        string sanitizedCategory = FrontendLogSanitizer.SanitizeText(request.Category);
        string sanitizedMessage = FrontendLogSanitizer.SanitizeText(request.Message);
        IDictionary<string, string> sanitizedContext = FrontendLogSanitizer.SanitizeContext(request.Context);
        string? sanitizedErrorId = string.IsNullOrWhiteSpace(request.ErrorId)
            ? null
            : FrontendLogSanitizer.SanitizeText(request.ErrorId);
        string requestId = HttpContext.TraceIdentifier;

        logger.LogInformation(
            "Frontend log accepted {LogId} {RequestId} {ErrorId} {Level} {Category} {Message} {Component} {@Context}",
            logId,
            requestId,
            sanitizedErrorId,
            sanitizedLevel,
            sanitizedCategory,
            sanitizedMessage,
            "frontend",
            sanitizedContext);

        return Accepted(new FrontendLogResponseDto(logId, "accepted"));
    }
}
