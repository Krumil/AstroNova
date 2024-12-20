const fs = require('fs').promises;
const path = require('path');

async function mergeFiles(inputPath, outputFile) {
    try {
        const outputStream = await fs.open(outputFile, 'w', 0o666); // Open in write mode

        async function processDirectory(dirPath) {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    await processDirectory(fullPath); // Recursive call for subdirectories
                } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('README_')) {
                    try {
                        const fileContent = await fs.readFile(fullPath, 'utf-8');
                        await outputStream.write(`--- FILE: ${fullPath} ---\n`);
                        await outputStream.write(fileContent);
                        await outputStream.write('\n\n');
                    } catch (err) {
                        console.error(`Error reading file ${fullPath}:`, err);
                    }
                }
            }
        }

        await processDirectory(inputPath);
        await outputStream.close();
        console.log(`Successfully merged .md files into: ${outputFile}`);

    } catch (err) {
        console.error(`An error occurred:`, err);
    }
}

async function main() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const question = (query) => new Promise(resolve => readline.question(query, resolve));

    try {
        const inputDirectory = await question("Enter the path to the directory containing .md files to merge: ");
        const outputFilename = await question("Enter the path to the output file: ");

        if (!await fs.stat(inputDirectory).then(stat => stat.isDirectory()).catch(() => false)) {
            console.error("Error: Input path is not a valid directory.");
            readline.close();
            return;
        }

        await mergeFiles(inputDirectory, outputFilename);
    } catch (err) {
        console.error("An error occurred during input:", err);
    } finally {
        readline.close();
    }
}

main();