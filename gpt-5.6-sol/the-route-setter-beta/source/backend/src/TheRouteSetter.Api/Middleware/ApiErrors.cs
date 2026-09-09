using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using TheRouteSetter.Api.Models;

namespace TheRouteSetter.Api.Middleware;

/// <summary>Unico contratto sicuro per errori MVC, routing ed eccezioni.</summary>
public static class ApiErrors
{
    private static readonly object ErrorKey = new();

    /// <summary>Crea e registra una sola correlazione per ogni richiesta fallita.</summary>
    public static ErrorResponse Create(HttpContext context, int status, Exception? exception = null, ILogger? logger = null)
    {
        if (context.Items.TryGetValue(ErrorKey, out var existing) && existing is ErrorResponse error)
        {
            return error;
        }

        var response = new ErrorResponse(Guid.NewGuid().ToString("N"), context.TraceIdentifier, status switch
        {
            400 => "La richiesta non e valida.",
            401 => "Autenticazione richiesta.",
            403 => "Operazione non consentita.",
            404 => "La risorsa richiesta non e disponibile.",
            405 => "Metodo non consentito.",
            413 => "La richiesta supera le dimensioni consentite.",
            415 => "Formato della richiesta non supportato.",
            416 => "L'intervallo richiesto non e disponibile.",
            429 => "Troppe richieste. Riprova piu tardi.",
            >= 500 => "Si e verificato un errore inatteso. Riprova o comunica l'identificativo al supporto.",
            _ => "La richiesta non puo essere completata."
        });
        context.Items[ErrorKey] = response;
        logger ??= context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("ApiErrors");
        using (logger.BeginScope(new Dictionary<string, object?>
        {
            ["ErrorId"] = response.ErrorId,
            ["RequestId"] = response.RequestId,
            ["Component"] = "Backend",
            ["Category"] = "ApiErrors"
        }))
        {
            logger.Log(status >= 500 ? LogLevel.Error : LogLevel.Warning, exception,
                "Richiesta non riuscita: HTTP {StatusCode}, errore {ErrorId}", status, response.ErrorId);
        }

        return response;
    }
}

/// <summary>Normalizza anche binding, validazione e risultati MVC con body tecnico.</summary>
public sealed class SafeErrorResultFilter : IAlwaysRunResultFilter
{
    /// <summary>Sostituisce i risultati MVC di errore con il contratto pubblico e lo stesso stato HTTP.</summary>
    public void OnResultExecuting(ResultExecutingContext context)
    {
        var status = (context.Result as IStatusCodeActionResult)?.StatusCode;
        if (status is >= 400 and <= 599)
        {
            context.Result = new JsonResult(ApiErrors.Create(context.HttpContext, status.Value))
            {
                StatusCode = status,
                ContentType = "application/json"
            };
        }
    }

    /// <summary>Non modifica la risposta dopo l'esecuzione: la normalizzazione avviene prima della scrittura.</summary>
    public void OnResultExecuted(ResultExecutedContext context) { }
}
