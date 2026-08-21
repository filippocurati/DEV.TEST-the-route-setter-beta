using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.StaticFiles;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using TheRouteSetter.Application.Assets;
using TheRouteSetter.Application.ConvexHull;
using TheRouteSetter.Api.Configuration;
using TheRouteSetter.Api.Middleware;
using TheRouteSetter.Api.Services;

var builder = WebApplication.CreateBuilder(args);

LoggingOptions bootstrapLoggingOptions = builder.Configuration.GetSection("LoggingOptions").Get<LoggingOptions>() ?? new LoggingOptions();
string bootstrapLogDirectory = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, bootstrapLoggingOptions.LogDirectoryPath));
Directory.CreateDirectory(bootstrapLogDirectory);

string minimumLevelValue = builder.Configuration["Logging:LogLevel:Default"] ?? "Information";
LogEventLevel minimumLogLevel = Enum.TryParse(minimumLevelValue, true, out LogEventLevel parsedMinimumLevel)
    ? parsedMinimumLevel
    : LogEventLevel.Information;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Is(minimumLogLevel)
    .Enrich.FromLogContext()
    .WriteTo.Async(configure =>
        configure.File(
            formatter: new CompactJsonFormatter(),
            path: Path.Combine(bootstrapLogDirectory, "application-.json"),
            rollingInterval: RollingInterval.Day,
            rollOnFileSizeLimit: true,
            fileSizeLimitBytes: 10 * 1024 * 1024,
            retainedFileCountLimit: 7,
            shared: true))
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.Configure<ApiDataOptions>(builder.Configuration.GetSection("ApiData"));
builder.Services.Configure<LoggingOptions>(builder.Configuration.GetSection("LoggingOptions"));

builder.Services.AddSingleton(provider =>
{
    ApiDataOptions dataOptions = provider.GetRequiredService<IOptions<ApiDataOptions>>().Value;
    IWebHostEnvironment environment = provider.GetRequiredService<IWebHostEnvironment>();

    return new AssetDiscoveryOptions
    {
        DataRootPath = ApiDataPathResolver.Resolve(environment.ContentRootPath, dataOptions.RelativeDataPath)
    };
});

builder.Services.AddSingleton<IAssetDiscoveryService, AssetDiscoveryService>();
builder.Services.AddSingleton<IColliderGenerationService, ColliderGenerationService>();
builder.Services.AddSingleton<AssetManifestService>();
builder.Services.AddHostedService<ColliderGenerationBackgroundService>();

var app = builder.Build();

ApiDataOptions apiDataOptions = app.Services.GetRequiredService<IOptions<ApiDataOptions>>().Value;
IWebHostEnvironment webHostEnvironment = app.Services.GetRequiredService<IWebHostEnvironment>();
string dataRootPath = ApiDataPathResolver.Resolve(webHostEnvironment.ContentRootPath, apiDataOptions.RelativeDataPath);

Directory.CreateDirectory(dataRootPath);

var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".glb"] = "model/gltf-binary";

app.UseMiddleware<GlobalExceptionHandlingMiddleware>();

app.UseSwagger();
app.UseSwaggerUI();

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(dataRootPath),
    RequestPath = "/data",
    ContentTypeProvider = contentTypeProvider
});

app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program;
