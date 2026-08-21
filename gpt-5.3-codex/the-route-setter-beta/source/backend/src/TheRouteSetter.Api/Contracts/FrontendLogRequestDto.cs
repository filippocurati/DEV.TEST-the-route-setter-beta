namespace TheRouteSetter.Api.Contracts;

public sealed record FrontendLogRequestDto(
    string Level,
    string Category,
    string Message,
    IDictionary<string, string>? Context,
    string? ErrorId = null);
