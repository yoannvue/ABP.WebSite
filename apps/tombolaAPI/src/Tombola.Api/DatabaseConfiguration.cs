using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;

namespace Tombola.Api;

internal static class DatabaseConfiguration
{
    public static string GetConnectionString(IConfiguration configuration, string contentRootPath)
    {
        var connectionString = configuration.GetConnectionString("Tombola");
        var builder = new SqliteConnectionStringBuilder(
            connectionString ?? "Data Source=data/tombola.db");

        if (builder.DataSource != ":memory:" && !Path.IsPathRooted(builder.DataSource))
        {
            builder.DataSource = Path.Combine(contentRootPath, builder.DataSource);
        }

        if (builder.DataSource != ":memory:")
        {
            var chemin = Path.GetFullPath(builder.DataSource);
            Directory.CreateDirectory(Path.GetDirectoryName(chemin)!);
            builder.DataSource = chemin;
        }

        builder.DefaultTimeout = 30;
        return builder.ToString();
    }

    public static string FindContentRoot(string baseDirectory)
    {
        var directory = new DirectoryInfo(baseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Tombola.Api.csproj")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        return Path.GetFullPath(baseDirectory);
    }
}
