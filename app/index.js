/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */

const {
    createChecks,
    ValidationError,
    getManifest,
    getFolderFiles,
    validateManifest,
} = require('./scripts/helper');

const { checkFolder, checkMaintainer, checkFolderFiles } = require('./scripts/check');

const fs = require('fs');
const { dirname } = require('path');

const Ajv = require('ajv');
const schemaName = 'info-json';
const ajv = Ajv({ allErrors: true });
const schema = fs.readFileSync('./config.json', 'utf8');
ajv.addSchema(JSON.parse(schema), schemaName);

module.exports = app => {
    app.on('pull_request', async context => {
        const pr = context.payload.pull_request;

        if (!pr || pr.state !== 'open') return;

        const checks = [],
            options = {
                app,
                context,
                pr,
                sha: pr.head.sha,
                user: pr.base.user,
                repo: pr.base.repo.name,
                org: pr.base.repo.owner.login,
                contextChecks: context.github.checks,
            };

        const { data: files } = await context.github.pullRequests.listFiles({
            number: options.pr.number,
            owner: options.org,
            repo: options.repo,
        });

        const folderName = dirname(files[0].filename);

        try {
            // ----- check folder -----
            checks.push(checkFolder(options, folderName, files));

            // ----- check maintainer -----
            const manifest = await getManifest(options, `${folderName}/manifest.json`);

            checks.push(checkMaintainer(options, manifest));

            const pluginFolderFiles = await getFolderFiles(
                options,
                `${folderName}?ref=${options.sha}`
            );

            // ----- validate manifest -----
            const manifestFile = pluginFolderFiles.data.length
                ? pluginFolderFiles.data.find(ele => ele.name.includes('manifest.json')) || {}
                : {};

            const fileContent = manifestFile
                ? await getManifest(options, `${manifestFile.path}?ref=${options.sha}`)
                : undefined;

            checks.push(validateManifest(options, ajv, schemaName, fileContent));

            // ----- create file lists from manifest -----
            checks.push(checkFolderFiles(options, fileContent, pluginFolderFiles));
        } catch (err) {
            if (!(err instanceof ValidationError)) {
                throw err;
            }
            return [...checks, createChecks(options, err.name, 'action_required', err)];
        }

        return checks;
    });
};
