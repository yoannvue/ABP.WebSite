namespace Tombola.Api;

public sealed class TombolaService(Database database)
{
    public async Task<Tirage> EffectuerTirageAsync()
    {
        var tirage = await database.EffectuerTirageAsync();
        if (tirage is null)
        {
            throw new TombolaTermineeException();
        }

        return tirage;
    }

    public Task<Statistiques> ObtenirStatistiquesAsync() => database.ObtenirStatistiquesAsync();

    public Task<Reinitialisation> ReinitialiserAsync() => database.ReinitialiserAsync();
}
