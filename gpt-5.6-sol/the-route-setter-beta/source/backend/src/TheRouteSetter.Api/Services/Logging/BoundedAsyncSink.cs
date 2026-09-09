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
    private readonly Action? maintenance;

    /// <summary>
    /// Inizializza una coda bounded; gli eventi eccedenti vengono scartati senza bloccare il chiamante.
    /// </summary>
    public BoundedAsyncSink(Serilog.ILogger target, int capacity, Action? maintenance = null)
    {
        this.target = target;
        this.maintenance = maintenance;
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
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        var tick = timer.WaitForNextTickAsync().AsTask();
        var available = events.Reader.WaitToReadAsync().AsTask();
        maintenance?.Invoke();
        while (true)
        {
            await Task.WhenAny(available, tick);
            maintenance?.Invoke();
            if (tick.IsCompleted) tick = timer.WaitForNextTickAsync().AsTask();
            if (!available.IsCompleted) continue;
            if (!await available) break;
            // A bounded batch prevents continuous producers from starving maintenance.
            for (var count = 0; count < 256 && events.Reader.TryRead(out var logEvent); count++)
            {
                target.Write(logEvent);
            }
            available = events.Reader.WaitToReadAsync().AsTask();
        }
    }
}
