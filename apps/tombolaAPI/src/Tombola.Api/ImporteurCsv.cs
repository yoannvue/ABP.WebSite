using System.Text;
using System.Text.RegularExpressions;
using System.Globalization;
using Microsoft.VisualBasic.FileIO;

namespace Tombola.Api;

internal static partial class ImporteurCsv
{
    public static async Task<int> ExecuterAsync(string[] args, string connectionString)
    {
        if (args.Length < 2 || !LireOptions(args, out var remplacer, out var perdantsParGagnant))
        {
            Console.Error.WriteLine(
                "Usage : Tombola.Api importer <fichier.csv> [--remplacer] [--perdants-par-gagnant <nombre>]");
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
            var lots = LireCsv(chemin);
            await ImporterAsync(database, lots, remplacer, perdantsParGagnant);
            var gagnants = lots.Sum(lot => lot.Quantite);
            var perdants = gagnants * perdantsParGagnant;

            Console.WriteLine(
                $"Import terminé : {gagnants + perdants} tickets générés ({gagnants} gagnants, {perdants} perdants).");
            Console.WriteLine($"Ratio : {perdantsParGagnant} ticket(s) perdant(s) par ticket gagnant.");
            foreach (var lot in lots.OrderBy(lot => lot.Nom, StringComparer.OrdinalIgnoreCase))
            {
                Console.WriteLine($"- {lot.Nom} : {lot.Quantite}");
            }

            return 0;
        }
        catch (ImportCsvException exception)
        {
            Console.Error.WriteLine(exception.Message);
            return 1;
        }
        catch (ArgumentException exception)
        {
            Console.Error.WriteLine($"Import refusé : {exception.Message}");
            return 1;
        }
    }

    private static bool LireOptions(string[] args, out bool remplacer, out int perdantsParGagnant)
    {
        remplacer = false;
        perdantsParGagnant = 1;
        var ratioDefini = false;

        for (var index = 2; index < args.Length; index++)
        {
            if (args[index] == "--remplacer" && !remplacer)
            {
                remplacer = true;
            }
            else if (args[index] == "--perdants-par-gagnant"
                && !ratioDefini
                && index + 1 < args.Length
                && int.TryParse(args[++index], NumberStyles.None, CultureInfo.InvariantCulture, out perdantsParGagnant)
                && perdantsParGagnant >= 0)
            {
                ratioDefini = true;
            }
            else
            {
                return false;
            }
        }

        return true;
    }

    private static List<LotCsv> LireCsv(string chemin)
    {
        var erreurs = new List<string>();
        var lots = new List<LotCsv>();
        var noms = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        using var lecteur = new TextFieldParser(chemin, Encoding.UTF8, detectEncoding: true)
        {
            TextFieldType = FieldType.Delimited,
            HasFieldsEnclosedInQuotes = true,
            TrimWhiteSpace = false
        };
        lecteur.SetDelimiters(";");

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

            if (champs is null || champs.Length != 2)
            {
                erreurs.Add($"Ligne {numeroLigne} : deux colonnes sont requises.");
                continue;
            }

            var nomLot = NormaliserNomLot(champs[0]);
            if (lots.Count == 0 && noms.Count == 0
                && (string.Equals(nomLot, "lot", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(nomLot, "nom", StringComparison.OrdinalIgnoreCase))
                && string.Equals(champs[1].Trim(), "quantite", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (nomLot.Length == 0)
            {
                erreurs.Add($"Ligne {numeroLigne} : le nom du lot est obligatoire.");
                continue;
            }

            if (!long.TryParse(champs[1].Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var quantite)
                || quantite <= 0)
            {
                erreurs.Add($"Ligne {numeroLigne} : la quantité doit être un entier strictement positif.");
                continue;
            }

            if (!noms.Add(nomLot))
            {
                erreurs.Add($"Ligne {numeroLigne} : le lot « {nomLot} » est en double.");
                continue;
            }

            lots.Add(new LotCsv(nomLot, quantite));
        }

        if (erreurs.Count > 0)
        {
            throw new ImportCsvException("Import refusé :\n" + string.Join('\n', erreurs));
        }

        if (lots.Count == 0)
        {
            throw new ImportCsvException("Le fichier ne contient aucun lot.");
        }

        return lots;
    }

    private static string NormaliserNomLot(string nom) =>
        EspacesMultiples().Replace(nom.Trim(), " ");

    private static async Task ImporterAsync(
        Database database,
        IReadOnlyList<LotCsv> lots,
        bool remplacer,
        int perdantsParGagnant)
    {
        var lotsAImporter = lots
            .Select(lot => new LotAImporter(lot.Nom, lot.Quantite))
            .ToArray();
        var importe = await database.ImporterLotsAsync(lotsAImporter, remplacer, perdantsParGagnant);
        if (!importe)
        {
            throw new ImportCsvException(
                "La base contient déjà des lots ou des tickets. Utilisez --remplacer pour les remplacer.");
        }
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex EspacesMultiples();

    private sealed record LotCsv(string Nom, long Quantite);

    private sealed class ImportCsvException(string message) : Exception(message)
    {
    }
}
