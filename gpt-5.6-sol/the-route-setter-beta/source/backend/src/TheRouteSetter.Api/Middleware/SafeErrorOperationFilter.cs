using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using TheRouteSetter.Api.Models;

namespace TheRouteSetter.Api.Middleware;

/// <summary>Documenta il contratto sicuro anche per gli errori prodotti dalla pipeline.</summary>
public sealed class SafeErrorOperationFilter : IOperationFilter
{
    /// <summary>Associa lo schema ErrorResponse agli errori dichiarati e agli stati comuni della pipeline.</summary>
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var schema = context.SchemaGenerator.GenerateSchema(typeof(ErrorResponse), context.SchemaRepository);
        foreach (var status in operation.Responses.Keys.Where(key => int.TryParse(key, out var code) && code >= 400)
                     .Concat(["400", "405", "500"]).Distinct().ToArray())
        {
            operation.Responses[status] = new OpenApiResponse
            {
                Description = "Errore sicuro correlabile tramite errorId e requestId.",
                Content = { ["application/json"] = new OpenApiMediaType { Schema = schema } }
            };
        }
    }
}
