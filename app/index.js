/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */

const fs = require('fs');
const Ajv = require('ajv');

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
        const pr = context.payload.pull_request;

        if (!pr || pr.state !== 'open') return;

        const sha = pr.head.sha;
        const repo = pr.base.repo.name;
        const org = pr.base.repo.owner.login;

        const files = await context.github.pullRequests.listFiles({
            number: pr.number,
            owner: org,
            repo: repo,
        });

        const checks = [];

        for (const file of files.data) {

            // if manifest file found
            // check folder from pull request
            // format namespace/name

            // save folder name
            // next get folder name and check with prev folder name
            // only one folder

            // files: readme (multiple), manifest.json (1x), images (multiple)
            // version object key readme: path to readme
            // get all files from repo an check folder with readme path

            // check prev/all commit/pull requests

            // Important: check if manifest destroyed, are all checks successful? if new file successful
            // Important: everytime check manifest

            // content will be base64 encoded

            const {
                data: { content: fileContent },
            } = await context.github.repos.getContents({
                owner: org,
                repo: repo,
                path: `${file.filename}?ref=${sha}`,
            });

            const response = validateSchema(
                schemaName,
                JSON.parse(Buffer.from(fileContent, 'base64').toString())
            );

            // validate file
            if (response === undefined) {
                checks.push(
                    context.github.checks.create({
                        owner: org,
                        repo: repo,
                        name: 'Manifest Scanner',
                        head_sha: pr.head.sha,
                        status: 'completed',
                        conclusion: 'success',
                        completed_at: new Date().toISOString(),
                        output: {
                            title: 'All tests successfull',
                            summary: '',
                        },
                    })
                );
            } else {
                checks.push(
                    context.github.checks.create({
                        owner: org,
                        repo: repo,
                        name: 'Manifest Scanner',
                        head_sha: pr.head.sha,
                        status: 'completed',
                        conclusion: 'action_required',
                        completed_at: new Date().toISOString(),
                        output: {
                            title: response.errors.length + ' Issues found',
                            summary: JSON.stringify(response.errors, null, 2),
                        },
                    })
                );
            }
        }

        return checks;
    });
};
