using TheRouteSetter.Api.Models;

namespace TheRouteSetter.Api.Services.Logging;

/// <summary>
/// Definisce l'ingresso base degli eventi diagnostici frontend.
/// </summary>
public interface IFrontendLogService
{
    /// <summary>
    /// Registra un evento frontend tramite il logging server-side.
    /// </summary>
    void Write(FrontendLogRequest request);
}
