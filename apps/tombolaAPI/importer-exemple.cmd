@echo off
setlocal

dotnet run --project "%~dp0src\Tombola.Api\Tombola.Api.csproj" -- importer "%~dp0exemples\lots.csv" --remplacer --perdants-par-gagnant 1
exit /b %ERRORLEVEL%
