using Microsoft.AspNetCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Tombola.Api;

if (args.Length > 0 && string.Equals(args[0], "importer", StringComparison.OrdinalIgnoreCase))
{
    var contentRootPath = DatabaseConfiguration.FindContentRoot(AppContext.BaseDirectory);
    var configuration = new ConfigurationBuilder()
        .SetBasePath(contentRootPath)
        .AddJsonFile("appsettings.json", optional: true)
        .AddEnvironmentVariables()
        .Build();
    return await ImporteurCsv.ExecuterAsync(
        args,
        DatabaseConfiguration.GetConnectionString(configuration, contentRootPath));
}

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(builder.Configuration["Urls"] ?? "http://localhost:5000");

var connectionString = DatabaseConfiguration.GetConnectionString(
    builder.Configuration,
    builder.Environment.ContentRootPath);
var database = new Database(connectionString);
await database.VerifierInitialisationAsync();

builder.Services.AddSingleton(database);
builder.Services.AddSingleton<TombolaService>();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseExceptionHandler(exceptionHandler =>
{
    exceptionHandler.Run(async context =>
    {
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger("Tombola.Api");
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        logger.LogError(exception, "Erreur non gérée pendant le traitement de la requête.");

        await Results.Problem(
            type: "https://tools.ietf.org/html/rfc9110#section-15.6.1",
            title: "Erreur interne du serveur",
            statusCode: StatusCodes.Status500InternalServerError,
            detail: "Une erreur inattendue est survenue.")
            .ExecuteAsync(context);
    });
});
app.UseCors();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapPost("/tirages", async (TombolaService service) =>
{
    try
    {
        return Results.Ok(await service.EffectuerTirageAsync());
    }
    catch (TombolaTermineeException)
    {
        return Results.Problem(
            type: "https://tools.ietf.org/html/rfc9110#section-15.5.10",
            title: "Tombola terminée",
            statusCode: StatusCodes.Status409Conflict,
            detail: "Tous les tickets ont déjà été tirés.");
    }
})
.WithName("EffectuerTirage")
.WithTags("Tirages")
.Produces<Tirage>()
.ProducesProblem(StatusCodes.Status409Conflict);

app.MapGet("/statistiques", async (TombolaService service) =>
    Results.Ok(await service.ObtenirStatistiquesAsync()))
    .WithName("ObtenirStatistiques")
    .WithTags("Statistiques")
    .Produces<Statistiques>();

app.MapPost("/administration/reinitialisation", async Task<IResult> (
    TombolaService service,
    int perdantsParGagnant = 1) =>
{
    if (perdantsParGagnant < 0)
    {
        return Results.Problem(
            title: "Ratio invalide",
            statusCode: StatusCodes.Status400BadRequest,
            detail: "Le nombre de tickets perdants par ticket gagnant doit être positif ou nul.");
    }

    try
    {
        return Results.Ok(await service.ReinitialiserAsync(perdantsParGagnant));
    }
    catch (ArgumentOutOfRangeException)
    {
        return Results.Problem(
            title: "Pool de tickets trop important",
            statusCode: StatusCodes.Status400BadRequest,
            detail: "Le ratio demandé dépasse la limite de 999 tickets.");
    }
})
    .WithName("ReinitialiserTickets")
    .WithTags("Administration")
    .WithSummary("Régénérer les tickets à partir des lots")
    .WithDescription("Recrée un ticket gagnant par exemplaire de lot et ajoute le ratio de tickets perdants demandé.")
    .Produces<Reinitialisation>()
    .ProducesProblem(StatusCodes.Status400BadRequest);

await app.RunAsync();
return 0;
