const fs = require('fs');
const path = require('path');

function getDownloadDirectory(projectRoot = path.resolve(__dirname, '..')) {
    return path.resolve(projectRoot, 'downloads');
}

function resetDownloadDirectory(downloadPath = getDownloadDirectory()) {
    fs.rmSync(downloadPath, { recursive: true, force: true });
    fs.mkdirSync(downloadPath, { recursive: true });
    return downloadPath;
}

function findCompletedDownload(downloadPath, existingFiles = new Set()) {
    const files = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];

    return files.find((file) => {
        if (existingFiles.has(file)) {
            return false;
        }
        return !file.endsWith('.crdownload') && !file.endsWith('.tmp');
    });
}

async function waitForDownload(downloadPath, existingFiles = new Set(), timeout = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const finished = findCompletedDownload(downloadPath, existingFiles);
        if (finished) {
            return path.join(downloadPath, finished);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error('❌ Téléchargement du fichier : timeout dépassé');
}

module.exports = {
    getDownloadDirectory,
    resetDownloadDirectory,
    findCompletedDownload,
    waitForDownload,
};
