using Microsoft.AspNetCore.Mvc;

namespace TheRouteSetter.Api.Controllers;

[ApiController]
[Route("api/diagnostics")]
public sealed class DiagnosticsController : ControllerBase
{
    [HttpGet("throw")]
    public IActionResult ThrowUnhandled()
    {
        throw new InvalidOperationException("Errore diagnostico intenzionale per test middleware.");
    }
}
