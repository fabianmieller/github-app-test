/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */

const { createChecks } = require('./scripts/createChecks');

const fs = require('fs');
const Ajv = require('ajv');
const { basename, dirname } = require('path');

const schemaName = 'info-json';
const ajv = Ajv({ allErrors: true });
const schema = fs.readFileSync('./config.json', 'utf8');
ajv.addSchema(JSON.parse(schema), schemaName);

module.exports = app => {
    function errorResponse(schemaErrors) {
        let errors = schemaErrors.map(error => {
            return {
                path: error.dataPath,
                message: error.message,
            };
        });
        return {
            status: 'failed',
            errors: errors,
        };
    }

    function validateSchema(schema, content) {
        let valid = ajv.validate(schema, content);
        if (!valid) {
            app.log(ajv.errorsText());
            return errorResponse(ajv.errors);
        }
    }

    app.on('pull_request', async context => {
        // files: readme (multiple), manifest.json (1x), images (multiple)

        const pr = context.payload.pull_request;

        if (!pr || pr.state !== 'open') return;

        const checks = [];
        const sha = pr.head.sha;
        const user = pr.base.user;
        const repo = pr.base.repo.name;
        const org = pr.base.repo.owner.login;
        const contextChecks = context.github.checks;

        const files = await context.github.pullRequests.listFiles({
            number: pr.number,
            owner: org,
            repo: repo,
        });

        // get folder from first file
        // check folder from pull request
        // save folder name
        const folderName = dirname(files.data[0].filename);

        if(folderName === '.') {
            // close pr with comment
            context.github.issues.createComment(context.issue({body: 'You are not allowed to create a pull request in this directory.'}))
            context.github.issues.edit(context.issue({state: 'closed'}))
        }

        // get manifest file
        const manifestData = await context.github.repos.getContents({
            owner: org,
            repo: repo,
            path: `${folderName}/manifest.json`,
        }).then(data => {
            return data;
        })
        .catch(err => {
            return {};
        });

        if(Object.keys(manifestData).length) {
            // parse manifest content
            const manifestRepoContent = JSON.parse(
                Buffer.from(manifestData.data.content, 'base64').toString()
            );

            app.log(manifestRepoContent.maintainer);
            app.log(user.login);

            // merge base check owner
            if(manifestRepoContent.maintainer === user.login) {
            // if('fabianmieller' === user.login) {
                checks.push(
                    createChecks(
                        contextChecks,
                        pr,
                        org,
                        repo,
                        'Maintainer Scanner',
                        'completed',
                        'success',
                        {
                            title: 'Pull request is allowed',
                            summary: '',
                        }
                    )
                )
            } else {
                return createChecks(
                    contextChecks,
                    pr,
                    org,
                    repo,
                    'Maintainer Scanner',
                    'completed',
                    'action_required',
                    {
                        title: 'Pull request not allowed',
                        summary: 'You are not allowed to create a pull request for this plugin.',
                    }
                )
            }
        } else {
             // return createChecks(
            //     contextChecks,
            //     pr,
            //     org,
            //     repo,
            //     'Manifest Scanner',
            //     'completed',
            //     'action_required',
            //     {
            //         title: '1 Issues found',
            //         summary: 'manifest.json not found',
            //     }
            // );
        }

        // get manifest file with foldername
        // if not found get manifest file manuell with foldername
        const manifestFile = files.data.find(ele =>
            ele.filename.includes('manifest.json')
        ) || {};

        if(Object.keys(manifestFile).length) {

            const {
                data: { content: fileContent },
            } = await context.github.repos.getContents({
                owner: org,
                repo: repo,
                path: `${manifestFile.filename}?ref=${sha}`,
            });

            const manifestContent = JSON.parse(
                Buffer.from(fileContent, 'base64').toString()
            );

            // validate manifest file
            if (manifestResponse = validateSchema(schemaName, manifestContent) === undefined) {
                checks.push(
                    createChecks(
                        contextChecks,
                        pr,
                        org,
                        repo,
                        'Manifest Scanner',
                        'completed',
                        'success',
                        {
                            title: 'Manifest file is valid',
                            summary: '',
                        }
                    )
                );
            } else {
                checks.push(
                    createChecks(
                        contextChecks,
                        pr,
                        org,
                        repo,
                        'Manifest Scanner',
                        'completed',
                        'action_required',
                        {
                            title: response.errors.length + ' Issues found',
                            summary: JSON.stringify(
                                response.errors,
                                null,
                                2
                            ),
                        }
                    )
                )
            }

        }

        // version object key readme: path to readme
        // get all files from repo an check folder with readme path

        // check changed files
        for (const file of files.data) {
            // get folder name and check with saved folder name
            // only one folder for one pull request
            app.log(`Filename: ${basename(file.filename)}`);
            app.log(`Foldername: ${dirname(file.filename)}`);

            if(dirname(file.filename) !== folderName) {
                return createChecks(
                    contextChecks,
                    pr,
                    org,
                    repo,
                    'File Scanner',
                    'completed',
                    'action_required',
                    {
                        title: 'Pull request not allowed',
                        summary: 'You are not allowed to create a pull request in different folders at the same time.',
                    }
                )
            }

            if (basename(file.filename) === 'manifest.json') {
                // compare manifest json's
            } else {
                checks.push(
                    createChecks(
                        contextChecks,
                        pr,
                        org,
                        repo,
                        'File Scanner',
                        'completed',
                        'success',
                        {
                            title: 'Pull request has no issues',
                            summary: '',
                        }
                    )
                );
            }

        }

        return checks;
    });
};
