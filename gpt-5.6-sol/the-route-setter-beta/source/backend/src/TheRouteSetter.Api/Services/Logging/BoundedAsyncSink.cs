using System.Threading.Channels;
using Serilog.Core;
using Serilog.Events;

namespace TheRouteSetter.Api.Services.Logging;

/// <summary>
/// Disaccoppia i thread applicativi dall'I/O tramite una coda bounded che privilegia la continuita.
/// </summary>
public sealed class BoundedAsyncSink : ILogEventSink, IDisposable
{
    private readonly Serilog.ILogger target;
    private readonly Channel<LogEvent> events;
    private readonly Task pump;

    /// <summary>
    /// Inizializza una coda bounded; gli eventi eccedenti vengono scartati senza bloccare il chiamante.
    /// </summary>
    public BoundedAsyncSink(Serilog.ILogger target, int capacity)
    {
        this.target = target;
        events = Channel.CreateBounded<LogEvent>(new BoundedChannelOptions(Math.Max(1, capacity))
        {
            FullMode = BoundedChannelFullMode.DropWrite,
            SingleReader = true,
            SingleWriter = false
        });
        pump = Task.Run(ProcessAsync);
    }

    /// <summary>
    /// Accoda l'evento senza attendere operazioni di file system.
    /// </summary>
    public void Emit(LogEvent logEvent)
    {
        events.Writer.TryWrite(logEvent);
    }

    /// <summary>
    /// Completa la coda, attende gli eventi residui e chiude il logger file.
    /// </summary>
    public void Dispose()
    {
        events.Writer.TryComplete();
        pump.GetAwaiter().GetResult();
        (target as IDisposable)?.Dispose();
    }

    /// <summary>
    /// Consuma in sequenza gli eventi e delega la scrittura al sink Serilog sottostante.
    /// </summary>
    private async Task ProcessAsync()
    {
        await foreach (var logEvent in events.Reader.ReadAllAsync())
        {
            target.Write(logEvent);
        }
    }
}
