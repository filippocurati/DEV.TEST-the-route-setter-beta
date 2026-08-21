using Xunit;

/// <summary>
/// Evita che host Serilog distinti contendano gli stessi logger statici durante i test di integrazione.
/// </summary>
[assembly: CollectionBehavior(DisableTestParallelization = true)]
