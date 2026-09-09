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
    ServerLoggingConfiguration.Configure(configuration, context.Configuration, context.HostingEnvironment.ContentRootPath),
    preserveStaticLogger: true);

builder.Services
    .AddControllers(options => options.Filters.Add<SafeErrorResultFilter>())
    .ConfigureApiBehaviorOptions(options => options.SuppressMapClientErrors = true)
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.OperationFilter<SafeErrorOperationFilter>();
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
builder.Services.AddSingleton<AssetDirectoryReader>();
builder.Services.AddSingleton<IAssetCatalogService, FileSystemAssetCatalogService>();
builder.Services.AddSingleton<ISensitiveDataSanitizer, SensitiveDataSanitizer>();
builder.Services.AddSingleton<IFrontendLogService, FrontendLogService>();
builder.Services.AddHostedService<ColliderGenerationWorker>();

var app = builder.Build();

app.UseMiddleware<RequestCorrelationMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSerilogRequestLogging(options => options.Logger = app.Services.GetRequiredService<Serilog.ILogger>());
app.UseStatusCodePages(async statusContext =>
{
    var context = statusContext.HttpContext;
    await context.Response.WriteAsJsonAsync(ApiErrors.Create(context, context.Response.StatusCode), context.RequestAborted);
});
app.Use(async (context, next) =>
{
    if (HttpMethods.IsPost(context.Request.Method)
        && context.Request.Path.Equals("/api/logs", StringComparison.OrdinalIgnoreCase)
        && context.Request.ContentLength > 32768)
    {
        context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
        return;
    }
    await next(context);
    if (context.Response.StatusCode == StatusCodes.Status416RangeNotSatisfiable && !context.Response.HasStarted)
    {
        // Il file result imposta 416 dopo i filtri MVC, lasciando tipo asset e lunghezza zero.
        context.Response.ContentLength = null;
        context.Response.ContentType = null;
        context.Response.Headers.Remove("Content-Disposition");
        await context.Response.WriteAsJsonAsync(ApiErrors.Create(context, context.Response.StatusCode), context.RequestAborted);
    }
});
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();

app.Run();

/// <summary>
/// Punto di ingresso dell'applicazione, esposto ai test di integrazione.
/// </summary>
public partial class Program;
