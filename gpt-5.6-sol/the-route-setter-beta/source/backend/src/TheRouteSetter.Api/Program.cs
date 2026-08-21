using System.Reflection;
using System.Text.Json.Serialization;
using Microsoft.OpenApi.Models;
using Serilog;
using TheRouteSetter.Api.Middleware;
using TheRouteSetter.Api.Services.Assets;
using TheRouteSetter.Api.Services.ConvexHull;
using TheRouteSetter.Api.Services.Logging;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, _, configuration) =>
    ServerLoggingConfiguration.Configure(configuration, context.Configuration, context.HostingEnvironment.ContentRootPath));

builder.Services
    .AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "The Route Setter API",
        Version = "v1",
        Description = "API per il catalogo locale degli asset di arrampicata indoor."
    });

    var xmlDocumentation = Path.Combine(
        AppContext.BaseDirectory,
        $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
    options.IncludeXmlComments(xmlDocumentation);
});
builder.Services.Configure<AssetStorageOptions>(builder.Configuration.GetSection(AssetStorageOptions.SectionName));
builder.Services.AddSingleton<IColliderJobStore, ColliderJobStore>();
builder.Services.AddSingleton<IGltfVertexReader, SharpGltfVertexReader>();
builder.Services.AddSingleton<IConvexHullBuilder, MiConvexHullBuilder>();
builder.Services.AddSingleton<IColliderProcessor, FileSystemColliderProcessor>();
builder.Services.AddSingleton<IAssetCatalogService, FileSystemAssetCatalogService>();
builder.Services.AddSingleton<ISensitiveDataSanitizer, SensitiveDataSanitizer>();
builder.Services.AddSingleton<IFrontendLogService, FrontendLogService>();
builder.Services.AddHostedService<ColliderGenerationWorker>();

var app = builder.Build();

app.UseMiddleware<RequestCorrelationMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSerilogRequestLogging();
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();

app.Run();

/// <summary>
/// Punto di ingresso dell'applicazione, esposto ai test di integrazione.
/// </summary>
public partial class Program;
