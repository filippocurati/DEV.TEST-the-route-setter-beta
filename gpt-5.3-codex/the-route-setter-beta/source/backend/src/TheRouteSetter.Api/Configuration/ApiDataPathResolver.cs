namespace TheRouteSetter.Api.Configuration;

public static class ApiDataPathResolver
{
    public static string Resolve(string contentRootPath, string configuredRelativeDataPath)
    {
        return Path.GetFullPath(Path.Combine(contentRootPath, configuredRelativeDataPath));
    }
}
