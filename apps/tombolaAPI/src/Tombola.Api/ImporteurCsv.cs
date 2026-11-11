using System.Text;
using System.Text.RegularExpressions;
using Microsoft.VisualBasic.FileIO;

namespace Tombola.Api;

internal static partial class ImporteurCsv
{
    public static async Task<int> ExecuterAsync(string[] args, string connectionString)
    {
        if (args.Length is < 2 or > 3 || (args.Length == 3 && args[2] != "--remplacer"))
        {
            Console.Error.WriteLine("Usage : Tombola.Api importer <fichier.csv> [--remplacer]");
            return 2;
        }

        var chemin = args[1];
        if (!File.Exists(chemin))
        {
            Console.Error.WriteLine($"Le fichier « {chemin} » est introuvable.");
            return 2;
        }

        var database = new Database(connectionString);
        await database.InitializeAsync();

        try
        {
            var lignes = LireCsv(chemin);
            var nombre = await ImporterAsync(database, lignes, args.Length == 3);
            var lots = lignes
                .Where(ligne => ligne.Lot is not null)
                .GroupBy(ligne => ligne.Lot!, StringComparer.OrdinalIgnoreCase)
                .OrderBy(groupe => groupe.Key, StringComparer.OrdinalIgnoreCase);

            Console.WriteLine($"Import terminé : {nombre} tickets, {lignes.Count(ligne => ligne.Lot is not null)} gagnants.");
            foreach (var lot in lots)
            {
                Console.WriteLine($"- {lot.Key} : {lot.Count()}");
            }

            return 0;
        }
        catch (ImportCsvException exception)
        {
            Console.Error.WriteLine(exception.Message);
            return 1;
        }
    }

    private static List<TicketCsv> LireCsv(string chemin)
    {
        var erreurs = new List<string>();
        var tickets = new List<TicketCsv>();
        var numeros = new HashSet<string>(StringComparer.Ordinal);

        using var lecteur = new TextFieldParser(chemin, Encoding.UTF8, detectEncoding: true)
        {
            TextFieldType = FieldType.Delimited,
            HasFieldsEnclosedInQuotes = true,
            TrimWhiteSpace = false
        };
        lecteur.SetDelimiters(";");

        string[]? entete;
        try
        {
            entete = lecteur.ReadFields();
        }
        catch (MalformedLineException exception)
        {
            throw new ImportCsvException($"En-tête CSV invalide : {exception.Message}");
        }

        if (entete is null
            || entete.Length != 2
            || !string.Equals(entete[0].Trim(), "numero", StringComparison.OrdinalIgnoreCase)
            || !string.Equals(entete[1].Trim(), "lot", StringComparison.OrdinalIgnoreCase))
        {
            throw new ImportCsvException("L'en-tête doit être exactement « numero;lot ».");
        }

        while (!lecteur.EndOfData)
        {
            var numeroLigne = lecteur.LineNumber;
            string[]? champs;
            try
            {
                champs = lecteur.ReadFields();
            }
            catch (MalformedLineException)
            {
                erreurs.Add($"Ligne {lecteur.ErrorLineNumber} : format CSV invalide.");
                continue;
            }

            var numero = champs is { Length: > 0 } ? champs[0].Trim() : string.Empty;
            var nomLot = champs is { Length: > 1 } ? NormaliserNomLot(champs[1]) : null;
            if (champs is null || champs.Length != 2)
            {
                erreurs.Add($"Ligne {numeroLigne} : deux colonnes sont requises.");
                continue;
            }

            if (numero.Length == 0)
            {
                erreurs.Add($"Ligne {numeroLigne} : le numéro du ticket est obligatoire.");
                continue;
            }

            if (!numeros.Add(numero))
            {
                erreurs.Add($"Ligne {numeroLigne} : le numéro « {numero} » est en double.");
                continue;
            }

            tickets.Add(new TicketCsv(numero, string.IsNullOrEmpty(nomLot) ? null : nomLot));
        }

        if (erreurs.Count > 0)
        {
            throw new ImportCsvException("Import refusé :\n" + string.Join('\n', erreurs));
        }

        if (tickets.Count == 0)
        {
            throw new ImportCsvException("Le fichier ne contient aucun ticket.");
        }

        return tickets;
    }

    private static string NormaliserNomLot(string nom) =>
        EspacesMultiples().Replace(nom.Trim(), " ");

    private static async Task<int> ImporterAsync(
        Database database,
        IReadOnlyList<TicketCsv> tickets,
        bool remplacer)
    {
        var ticketsAImporter = tickets
            .Select(ticket => new TicketAImporter(ticket.Numero, ticket.Lot))
            .ToArray();
        var importe = await database.ImporterTicketsAsync(ticketsAImporter, remplacer);
        if (!importe)
        {
            throw new ImportCsvException(
                "La base contient déjà des tickets. Utilisez --remplacer pour les remplacer.");
        }

        return tickets.Count;
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex EspacesMultiples();

    private sealed record TicketCsv(string Numero, string? Lot);

    private sealed class ImportCsvException(string message) : Exception(message)
    {
    }
}
