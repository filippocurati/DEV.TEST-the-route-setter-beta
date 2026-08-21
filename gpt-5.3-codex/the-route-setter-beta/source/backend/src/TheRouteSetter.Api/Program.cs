using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.StaticFiles;
using TheRouteSetter.Application.Assets;
using TheRouteSetter.Application.ConvexHull;
using TheRouteSetter.Api.Configuration;
using TheRouteSetter.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.Configure<ApiDataOptions>(builder.Configuration.GetSection("ApiData"));

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
