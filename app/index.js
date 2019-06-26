/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */

const { checkFolder, createChecks, checkMaintainer, validateSchema } = require('./scripts/helper');

const fs = require('fs');
const Ajv = require('ajv');
const { basename, dirname } = require('path');

const schemaName = 'info-json';
const ajv = Ajv({ allErrors: true });
const schema = fs.readFileSync('./config.json', 'utf8');
ajv.addSchema(JSON.parse(schema), schemaName);

module.exports = app => {
    app.on('pull_request', async context => {
        // files: readme (multiple), manifest.json (1x), images (multiple)

        const pr = context.payload.pull_request;

        if (!pr || pr.state !== 'open') return;

        const checks = [];
        const options = {
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

        // get folder from first file
        // check folder from pull request
        // save folder name

        const folderName = dirname(files[0].filename);

        // ----- check folder -----

        if (checkFolder(folderName, files, options)) {
            checks.push(
                createChecks(options, 'Folder', 'success', {
                    title: 'Plugin folder is correct',
                })
            );
        } else {
            return createChecks(options, 'Folder', 'action_required', {
                title: 'Pull request not allowed',
                summary:
                    'You are not allowed to create a pull request in different folders at the same time.',
            });
        }

        // -----------------------

        // ----- check maintainer -----

        // get manifest file
        const manifestData = await context.github.repos
            .getContents({
                owner: options.org,
                repo: options.repo,
                path: `${folderName}/manifest.json`,
            })
            .catch(err => {
                return {};
            });

        const manifest = manifestData.length ? JSON.parse(Buffer.from(manifestData.data.content, 'base64').toString()) : undefined;

        // parse manifest content
        checks.push(checkMaintainer(manifest, options))

        // wrap all with try catch and catch with checks

        // -----------------------

        const { data: pluginFolderFiles } = await context.github.repos
            .getContents({
                owner: options.org,
                repo: options.repo,
                path: `${folderName}?ref=${options.sha}`,
            })
            .catch(err => {
                return {};
            });

        // ----- validate manifest -----

        const manifestFile =
            pluginFolderFiles.find(ele => ele.name.includes('manifest.json')) || {};

        let fileContent;

        if (Object.keys(manifestFile).length) {
            const {
                data: { content },
            } = await context.github.repos.getContents({
                owner: options.org,
                repo: options.repo,
                path: `${manifestFile.path}?ref=${options.sha}`,
            });

            fileContent = JSON.parse(Buffer.from(content, 'base64').toString());
        }

        if (fileContent) {
            // validate manifest file
            if ((manifestResponse = validateSchema(ajv, schemaName, fileContent))) {
                checks.push(
                    createChecks(options, 'Manifest', 'success', {
                        title: 'Manifest file is valid',
                    })
                );
            } else {
                checks.push(
                    createChecks(options, 'Manifest', 'action_required', {
                        title: manifestResponse.errors.length + ' Issues found',
                        summary: JSON.stringify(manifestResponse.errors, null, 2),
                    })
                );
            }
        } else {
            return createChecks(options, 'Manifest', 'action_required', {
                title: 'manifest.json not found',
            });
        }

        // -----------------------

        // ----- create file lists from manifest -----

        const readmeList = [],
            imageList = [];

        fileContent.versions.forEach(v => {
            if (v.readme && readmeList.indexOf(v.image) === -1) {
                readmeList.push(v.readme);
            }
            if (v.image && imageList.indexOf(v.image) === -1) {
                imageList.push(v.image);
            }
        });

        // -----------------------

        // check changed files with fileList
        for (const { name } of pluginFolderFiles) {
            if (name === 'manifest.json') {
                continue;
            }

            if ((i = readmeList.indexOf(name)) !== -1) {
                readmeList.splice(i, 1);
                continue;
            }

            if ((i = imageList.indexOf(name)) !== -1) {
                imageList.splice(i, 1);
                continue;
            }
        }

        if (imageList.length !== 0 || readmeList.length !== 0) {
            checks.push(
                createChecks(options, 'Files', 'action_required', {
                    title: 'Undefined files found',
                    summary: `${readmeList.concat(imageList).join(', ')}`,
                })
            );
        } else {
            checks.push(
                createChecks(options, 'Files', 'success', {
                    title: 'All files ok',
                })
            );
        }

        return checks;
    });
};
