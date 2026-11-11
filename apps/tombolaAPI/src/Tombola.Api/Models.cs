namespace Tombola.Api;

public sealed record Tirage(string Numero, bool Gagnant, string? Lot, DateTimeOffset DateTirage);

public sealed class StatistiqueLot
{
    public string Nom { get; set; } = string.Empty;
    public long Quantite { get; set; }
    public long Restants { get; set; }
}

public sealed record Statistiques(
    long TicketsRestants,
    long TicketsGagnantsRestants,
    IReadOnlyList<StatistiqueLot> Lots);

public sealed record Reinitialisation(int TicketsReinitialises);

public sealed record TicketAImporter(string Numero, string? Lot);

public sealed class TombolaTermineeException : Exception
{
    public TombolaTermineeException()
        : base("Tous les tickets ont déjà été tirés.")
    {
    }
}
