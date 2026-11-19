using System.Globalization;
using Dapper;
using Microsoft.Data.Sqlite;

namespace Tombola.Api;

public sealed class Database
{
    private const int NombreMaximumTickets = 999;
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
                (SELECT COUNT(*) FROM Ticket) AS TicketsTotaux,
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
        return new Statistiques(totaux.TicketsRestants, totaux.TicketsGagnantsRestants, lots)
        {
            TicketsTotaux = totaux.TicketsTotaux
        };
    }

    public async Task<Reinitialisation> ReinitialiserAsync(int perdantsParGagnant = 1)
    {
        await using var connection = await OpenConnectionAsync();
        using var transaction = connection.BeginTransaction(deferred: false);
        var lots = (await connection.QueryAsync<LotPourTickets>(
            "SELECT Id, Quantite FROM Lot ORDER BY Id;",
            transaction: transaction)).AsList();
        var resultat = await CreerTicketsAsync(connection, transaction, lots, perdantsParGagnant);
        transaction.Commit();
        return resultat;
    }

    public async Task<bool> ImporterLotsAsync(
        IReadOnlyList<LotAImporter> lots,
        bool remplacer,
        int perdantsParGagnant = 1)
    {
        ValiderLots(lots);
        await using var connection = await OpenConnectionAsync();
        using var transaction = connection.BeginTransaction(deferred: false);
        var donneesExistantes = await connection.ExecuteScalarAsync<long>(
            "SELECT (SELECT COUNT(*) FROM Ticket) + (SELECT COUNT(*) FROM Lot);",
            transaction: transaction);

        if (donneesExistantes > 0 && !remplacer)
        {
            return false;
        }

        if (remplacer)
        {
            await connection.ExecuteAsync("DELETE FROM Ticket; DELETE FROM Lot;", transaction: transaction);
        }

        var lotsPourTickets = new List<LotPourTickets>(lots.Count);
        foreach (var lot in lots)
        {
            var idLot = await connection.ExecuteScalarAsync<long>(
                """
                INSERT INTO Lot (Nom, Quantite)
                VALUES (@Nom, @Quantite)
                RETURNING Id;
                """,
                new { lot.Nom, lot.Quantite },
                transaction);
            lotsPourTickets.Add(new LotPourTickets(idLot, lot.Quantite));
        }

        await CreerTicketsAsync(connection, transaction, lotsPourTickets, perdantsParGagnant);
        transaction.Commit();
        return true;
    }

    private static void ValiderLots(IReadOnlyList<LotAImporter> lots)
    {
        if (lots.Count == 0)
        {
            throw new ArgumentException("Le fichier doit contenir au moins un lot.", nameof(lots));
        }

        if (lots.Any(lot => string.IsNullOrWhiteSpace(lot.Nom) || lot.Quantite <= 0))
        {
            throw new ArgumentException("Chaque lot doit avoir un nom et une quantité strictement positive.", nameof(lots));
        }

        if (lots.Select(lot => lot.Nom).Distinct(StringComparer.OrdinalIgnoreCase).Count() != lots.Count)
        {
            throw new ArgumentException("Les noms de lots doivent être uniques.", nameof(lots));
        }
    }

    private static async Task<Reinitialisation> CreerTicketsAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        IReadOnlyList<LotPourTickets> lots,
        int perdantsParGagnant)
    {
        if (perdantsParGagnant < 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(perdantsParGagnant),
                "Le ratio de tickets perdants doit être positif ou nul.");
        }

        long gagnants = 0;
        foreach (var lot in lots)
        {
            if (lot.Quantite < 0 || lot.Quantite > NombreMaximumTickets - gagnants)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(lots),
                    $"Le nombre de tickets gagnants dépasse la limite de {NombreMaximumTickets} tickets.");
            }

            gagnants += lot.Quantite;
        }

        if (gagnants <= 0)
        {
            throw new InvalidOperationException("La base ne contient aucun lot avec une quantité positive.");
        }

        if (gagnants > NombreMaximumTickets
            || perdantsParGagnant > (NombreMaximumTickets - gagnants) / gagnants)
        {
            throw new ArgumentOutOfRangeException(
                nameof(perdantsParGagnant),
                $"La réinitialisation dépasserait la limite de {NombreMaximumTickets} tickets.");
        }

        var perdants = gagnants * perdantsParGagnant;
        var tickets = new List<long?>((int)(gagnants + perdants));
        foreach (var lot in lots)
        {
            for (long index = 0; index < lot.Quantite; index++)
            {
                tickets.Add(lot.Id);
            }
        }

        for (long index = 0; index < perdants; index++)
        {
            tickets.Add(null);
        }

        for (var index = tickets.Count - 1; index > 0; index--)
        {
            var autreIndex = Random.Shared.Next(index + 1);
            (tickets[index], tickets[autreIndex]) = (tickets[autreIndex], tickets[index]);
        }

        await connection.ExecuteAsync("DELETE FROM Ticket;", transaction: transaction);
        var nouvellesLignes = tickets.Select((lotId, index) => new
        {
            Numero = (index + 1).ToString("D3", CultureInfo.InvariantCulture),
            LotId = lotId
        });
        await connection.ExecuteAsync(
            "INSERT INTO Ticket (Numero, LotId) VALUES (@Numero, @LotId);",
            nouvellesLignes,
            transaction);

        return new Reinitialisation(
            tickets.Count,
            (int)gagnants,
            (int)perdants,
            perdantsParGagnant);
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
    private sealed record LotPourTickets(long Id, long Quantite);

    private sealed record Totaux(
        long TicketsTotaux,
        long TicketsRestants,
        long TicketsGagnantsRestants);
}
