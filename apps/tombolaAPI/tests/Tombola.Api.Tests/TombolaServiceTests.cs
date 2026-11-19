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
        await fixture.AjouterLotsAsync(new LotAImporter("Ballon", 1));

        var statistiquesInitiales = await fixture.Service.ObtenirStatistiquesAsync();
        Assert.Equal(2L, statistiquesInitiales.TicketsTotaux);
        Assert.Equal(2L, statistiquesInitiales.TicketsRestants);
        Assert.Equal(1L, statistiquesInitiales.TicketsGagnantsRestants);
        Assert.Equal(1L, Assert.Single(statistiquesInitiales.Lots).Restants);

        var tirage = await fixture.Service.EffectuerTirageAsync();
        Assert.Equal(tirage.Lot is not null, tirage.Gagnant);

        var resultatReinitialisation = await fixture.Service.ReinitialiserAsync(perdantsParGagnant: 2);
        Assert.Equal(3, resultatReinitialisation.TicketsReinitialises);
        Assert.Equal(1, resultatReinitialisation.TicketsGagnants);
        Assert.Equal(2, resultatReinitialisation.TicketsPerdants);
        Assert.Equal(2, resultatReinitialisation.PerdantsParGagnant);
        var statistiquesReinitialisees = await fixture.Service.ObtenirStatistiquesAsync();
        Assert.Equal(3L, statistiquesReinitialisees.TicketsTotaux);
        Assert.Equal(3L, statistiquesReinitialisees.TicketsRestants);
        Assert.Equal(1L, statistiquesReinitialisees.TicketsGagnantsRestants);
    }

    [Fact]
    public async Task TiragesSimultanesNeRetournentJamaisLeMemeTicket()
    {
        await using var fixture = await Fixture.CreerAsync();
        await fixture.AjouterLotsAsync(new LotAImporter("Lot", 24), perdantsParGagnant: 0);

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
    public async Task ImportRefuseUnPoolQuiDepasse999TicketsSansModifierLaBase()
    {
        await using var fixture = await Fixture.CreerAsync();

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => fixture.Database.ImporterLotsAsync(
                new[] { new LotAImporter("Lot", 500) },
                remplacer: false));

        var statistiques = await fixture.Service.ObtenirStatistiquesAsync();
        Assert.Equal(0L, statistiques.TicketsRestants);
        Assert.Empty(statistiques.Lots);
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

        public async Task AjouterLotsAsync(
            LotAImporter lot,
            int perdantsParGagnant = 1)
        {
            Assert.True(await Database.ImporterLotsAsync(
                new[] { lot },
                remplacer: false,
                perdantsParGagnant: perdantsParGagnant));
        }

        public ValueTask DisposeAsync()
        {
            SqliteConnection.ClearAllPools();
            File.Delete(_chemin);
            return ValueTask.CompletedTask;
        }
    }
}
