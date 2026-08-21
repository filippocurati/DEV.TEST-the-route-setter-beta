using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using TheRouteSetter.Api.Middleware;
using TheRouteSetter.Api.Models;
using Xunit;

namespace TheRouteSetter.Api.Tests;

/// <summary>
/// Verifica il contratto sicuro e la correlazione degli errori backend.
/// </summary>
public sealed class ErrorHandlingMiddlewareTests
{
    /// <summary>
    /// Verifica che una eccezione inattesa produca HTTP 500 senza dettagli tecnici.
    /// </summary>
    [Fact]
    public async Task UnexpectedException_ReturnsSafeCorrelatedResponse()
    {
        var logger = new CapturingLogger<ExceptionHandlingMiddleware>();
        var exception = new InvalidDataException("password=super-secret C:\\internal\\server.cs");
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw exception,
            logger);
        var context = new DefaultHttpContext { TraceIdentifier = "request-test-1" };
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);
        context.Response.Body.Position = 0;
        var response = await JsonSerializer.DeserializeAsync<ErrorResponse>(
            context.Response.Body,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        Assert.NotNull(response);
        Assert.Equal("request-test-1", response.RequestId);
        Assert.Matches("^[a-f0-9]{32}$", response.ErrorId);
        Assert.DoesNotContain("password", response.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("internal", response.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(response.ErrorId, logger.ScopeValues.Select(value => value?.ToString()));
        Assert.Same(exception, logger.CapturedException);
    }

    /// <summary>
    /// Verifica la traduzione coerente delle eccezioni note senza esporne il messaggio.
    /// </summary>
    [Theory]
    [InlineData(typeof(ArgumentException), StatusCodes.Status400BadRequest)]
    [InlineData(typeof(FileNotFoundException), StatusCodes.Status404NotFound)]
    public async Task KnownException_MapsToCoherentStatus(Type exceptionType, int expectedStatus)
    {
        var exception = (Exception)Activator.CreateInstance(exceptionType, "technical detail")!;
        var middleware = new ExceptionHandlingMiddleware(_ => throw exception, new CapturingLogger<ExceptionHandlingMiddleware>());
        var context = new DefaultHttpContext { TraceIdentifier = "request-map" };
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);
        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();

        Assert.Equal(expectedStatus, context.Response.StatusCode);
        Assert.DoesNotContain("technical detail", body);
    }

    /// <summary>
    /// Logger minimale che conserva eccezione e scope per le asserzioni del middleware.
    /// </summary>
    private sealed class CapturingLogger<T> : ILogger<T>
    {
        /// <summary>
        /// Eccezione ricevuta dal logger.
        /// </summary>
        public Exception? CapturedException { get; private set; }

        /// <summary>
        /// Valori raccolti dagli scope strutturati.
        /// </summary>
        public List<object?> ScopeValues { get; } = [];

        /// <inheritdoc />
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
        {
            if (state is IEnumerable<KeyValuePair<string, object?>> values)
            {
                ScopeValues.AddRange(values.Select(item => item.Value));
            }

            return NullScope.Instance;
        }

        /// <inheritdoc />
        public bool IsEnabled(LogLevel logLevel) => true;

        /// <inheritdoc />
        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            CapturedException = exception;
        }

        private sealed class NullScope : IDisposable
        {
            /// <summary>
            /// Istanza condivisa dello scope vuoto.
            /// </summary>
            public static NullScope Instance { get; } = new();

            /// <inheritdoc />
            public void Dispose()
            {
            }
        }
    }
}
