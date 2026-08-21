using TheRouteSetter.Backend.Services.Wall;
using TheRouteSetter.Backend.Services.Catalog;
using TheRouteSetter.Backend.Services.Logging;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<WallService>();
builder.Services.AddSingleton<HoldDiscoveryService>();
builder.Services.AddSingleton<LogReceiverService>();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "Data")),
    RequestPath = "/static"
});

app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program { }