@echo off
setlocal

dotnet run --project "%~dp0src\Tombola.Api\Tombola.Api.csproj" -- importer "%~dp0exemples\tickets.csv" --remplacer
exit /b %ERRORLEVEL%
