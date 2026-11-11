using Microsoft.Data.Sqlite;
using Tombola.Api;
using Xunit;

namespace Tombola.Api.Tests;

public sealed class TombolaServiceTests
{
    [Fact]
    public async Task TirageEtReinitialisationMettenAJourLesStatistiques()
    {
        await using var fixture = await Fixture.CreerAsync();
        await fixture.AjouterTicketsAsync(
            new TicketAImporter("0001", "Ballon"),
            new TicketAImporter("0002", null));

        var statistiquesInitiales = await fixture.Service.ObtenirStatistiquesAsync();
        Assert.Equal(2L, statistiquesInitiales.TicketsRestants);
        Assert.Equal(1L, statistiquesInitiales.TicketsGagnantsRestants);
        Assert.Equal(1L, Assert.Single(statistiquesInitiales.Lots).Restants);

        var tirage = await fixture.Service.EffectuerTirageAsync();
        Assert.Equal(tirage.Lot is not null, tirage.Gagnant);

        var resultatReinitialisation = await fixture.Service.ReinitialiserAsync();
        Assert.Equal(1, resultatReinitialisation.TicketsReinitialises);
        Assert.Equal(2L, (await fixture.Service.ObtenirStatistiquesAsync()).TicketsRestants);
    }

    [Fact]
    public async Task TiragesSimultanesNeRetournentJamaisLeMemeTicket()
    {
        await using var fixture = await Fixture.CreerAsync();
        await fixture.AjouterTicketsAsync(
            Enumerable.Range(0, 24)
                .Select(index => new TicketAImporter(index.ToString("D4"), null))
                .ToArray());

        var resultats = await Task.WhenAll(
            Enumerable.Range(0, 40).Select(async _ =>
            {
                try
                {
                    return await fixture.Service.EffectuerTirageAsync();
                }
                catch (TombolaTermineeException)
                {
                    return null;
                }
            }));

        var tirages = resultats.OfType<Tirage>().ToArray();
        Assert.Equal(24, tirages.Length);
        Assert.Equal(24, tirages.Select(tirage => tirage.Numero).Distinct().Count());
        Assert.Equal(0L, (await fixture.Service.ObtenirStatistiquesAsync()).TicketsRestants);
    }

    [Fact]
    public async Task TirerSansTicketDisponibleSignaleLaFinDeLaTombola()
    {
        await using var fixture = await Fixture.CreerAsync();

        await Assert.ThrowsAsync<TombolaTermineeException>(
            () => fixture.Service.EffectuerTirageAsync());
    }

    [Fact]
    public async Task VerifierInitialisationNeCreePasUneBaseAbsente()
    {
        var chemin = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.db");
        var database = new Database($"Data Source={chemin}");

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => database.VerifierInitialisationAsync());
        Assert.False(File.Exists(chemin));
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly string _chemin;

        private Fixture(string chemin, Database database)
        {
            _chemin = chemin;
            Database = database;
            Service = new TombolaService(database);
        }

        public Database Database { get; }
        public TombolaService Service { get; }

        public static async Task<Fixture> CreerAsync()
        {
            var chemin = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.db");
            var database = new Database($"Data Source={chemin}");
            await database.InitializeAsync();
            return new Fixture(chemin, database);
        }

        public async Task AjouterTicketsAsync(params TicketAImporter[] tickets)
        {
            Assert.True(await Database.ImporterTicketsAsync(tickets, remplacer: false));
        }

        public ValueTask DisposeAsync()
        {
            SqliteConnection.ClearAllPools();
            File.Delete(_chemin);
            return ValueTask.CompletedTask;
        }
    }
}
