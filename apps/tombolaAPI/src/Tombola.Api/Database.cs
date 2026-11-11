using System.Globalization;
using Dapper;
using Microsoft.Data.Sqlite;

namespace Tombola.Api;

public sealed class Database
{
    private readonly string _connectionString;
    private readonly string _cheminBase;

    public Database(string connectionString)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString)
        {
            ForeignKeys = true,
            DefaultTimeout = 30
        };
        _connectionString = builder.ToString();
        _cheminBase = builder.DataSource;
    }

    private async Task<SqliteConnection> OpenConnectionAsync()
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        return connection;
    }

    public async Task<Tirage?> EffectuerTirageAsync()
    {
        await using var connection = await OpenConnectionAsync();
        using var transaction = connection.BeginTransaction(deferred: false);

        var ticket = await connection.QuerySingleOrDefaultAsync<TicketATirer>(
            """
            SELECT t.Id, t.Numero, l.Nom AS Lot
            FROM Ticket t
            LEFT JOIN Lot l ON l.Id = t.LotId
            WHERE t.DateTirage IS NULL
            ORDER BY random()
            LIMIT 1;
            """,
            transaction: transaction);

        if (ticket is null)
        {
            transaction.Commit();
            return null;
        }

        var dateTirage = DateTimeOffset.Now;
        var lignesModifiees = await connection.ExecuteAsync(
            """
            UPDATE Ticket
            SET DateTirage = @DateTirage
            WHERE Id = @Id AND DateTirage IS NULL;
            """,
            new
            {
                DateTirage = dateTirage.ToString("O", CultureInfo.InvariantCulture),
                ticket.Id
            },
            transaction);

        if (lignesModifiees != 1)
        {
            throw new InvalidOperationException("Le ticket sélectionné n'a pas pu être clôturé.");
        }

        transaction.Commit();
        return new Tirage(ticket.Numero, ticket.Lot is not null, ticket.Lot, dateTirage);
    }

    public async Task<Statistiques> ObtenirStatistiquesAsync()
    {
        await using var connection = await OpenConnectionAsync();
        using var transaction = connection.BeginTransaction(deferred: true);

        var totaux = await connection.QuerySingleAsync<Totaux>(
            """
            SELECT
                (SELECT COUNT(*) FROM Ticket WHERE DateTirage IS NULL) AS TicketsRestants,
                (SELECT COUNT(*) FROM Ticket WHERE LotId IS NOT NULL AND DateTirage IS NULL)
                    AS TicketsGagnantsRestants;
            """,
            transaction: transaction);
        var lots = (await connection.QueryAsync<StatistiqueLot>(
            """
            SELECT l.Nom, l.Quantite, COUNT(t.Id) AS Restants
            FROM Lot l
            LEFT JOIN Ticket t ON t.LotId = l.Id AND t.DateTirage IS NULL
            GROUP BY l.Id, l.Nom, l.Quantite
            ORDER BY l.Nom COLLATE NOCASE;
            """,
            transaction: transaction)).AsList();

        transaction.Commit();
        return new Statistiques(totaux.TicketsRestants, totaux.TicketsGagnantsRestants, lots);
    }

    public async Task<Reinitialisation> ReinitialiserAsync()
    {
        await using var connection = await OpenConnectionAsync();
        var ticketsReinitialises = await connection.ExecuteAsync(
            "UPDATE Ticket SET DateTirage = NULL WHERE DateTirage IS NOT NULL;");
        return new Reinitialisation(ticketsReinitialises);
    }

    public async Task<bool> ImporterTicketsAsync(
        IReadOnlyList<TicketAImporter> tickets,
        bool remplacer)
    {
        await using var connection = await OpenConnectionAsync();
        using var transaction = connection.BeginTransaction(deferred: false);
        var ticketsExistants = await connection.ExecuteScalarAsync<long>(
            "SELECT COUNT(*) FROM Ticket;",
            transaction: transaction);

        if (ticketsExistants > 0 && !remplacer)
        {
            return false;
        }

        if (remplacer)
        {
            await connection.ExecuteAsync("DELETE FROM Ticket; DELETE FROM Lot;", transaction: transaction);
        }

        var identifiantsLots = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        foreach (var groupe in tickets
                     .Where(ticket => ticket.Lot is not null)
                     .GroupBy(ticket => ticket.Lot!, StringComparer.OrdinalIgnoreCase))
        {
            var idLot = await connection.ExecuteScalarAsync<long>(
                """
                INSERT INTO Lot (Nom, Quantite)
                VALUES (@Nom, @Quantite)
                RETURNING Id;
                """,
                new { Nom = groupe.Key, Quantite = groupe.Count() },
                transaction);
            identifiantsLots.Add(groupe.Key, idLot);
        }

        foreach (var ticket in tickets)
        {
            long? lotId = ticket.Lot is null ? null : identifiantsLots[ticket.Lot];
            await connection.ExecuteAsync(
                "INSERT INTO Ticket (Numero, LotId) VALUES (@Numero, @LotId);",
                new { ticket.Numero, LotId = lotId },
                transaction);
        }

        transaction.Commit();
        return true;
    }

    public async Task InitializeAsync()
    {
        await using var connection = await OpenConnectionAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS Lot (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Nom TEXT NOT NULL COLLATE NOCASE UNIQUE,
                Quantite INTEGER NOT NULL CHECK (Quantite >= 0)
            );

            CREATE TABLE IF NOT EXISTS Ticket (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Numero TEXT NOT NULL UNIQUE,
                LotId INTEGER NULL REFERENCES Lot(Id),
                DateTirage TEXT NULL
            );

            CREATE INDEX IF NOT EXISTS IX_Ticket_DateTirage ON Ticket(DateTirage);
            CREATE INDEX IF NOT EXISTS IX_Ticket_LotId_DateTirage ON Ticket(LotId, DateTirage);
            """;
        await command.ExecuteNonQueryAsync();
    }

    public async Task VerifierInitialisationAsync()
    {
        if (_cheminBase == ":memory:" || !File.Exists(_cheminBase))
        {
            throw new InvalidOperationException(
                $"La base de données « {_cheminBase} » est introuvable. " +
                "Initialisez-la avec la commande « importer » avant de démarrer l'API.");
        }

        await using var connection = await OpenConnectionAsync();
        var tables = await connection.ExecuteScalarAsync<long>(
            """
            SELECT COUNT(*)
            FROM sqlite_master
            WHERE type = 'table' AND name IN ('Lot', 'Ticket');
            """);

        if (tables != 2)
        {
            throw new InvalidOperationException(
                $"La base de données « {_cheminBase} » n'est pas initialisée. " +
                "Initialisez-la avec la commande « importer » avant de démarrer l'API.");
        }
    }

    private sealed record TicketATirer(long Id, string Numero, string? Lot);

    private sealed record Totaux(long TicketsRestants, long TicketsGagnantsRestants);
}
