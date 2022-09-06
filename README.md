# titoportas/update-project-fields

Use this action to automatically update [GitHub project (beta)](https://docs.github.com/en/issues/trying-out-the-new-projects-experience/about-projects) item fields.
Note that this action *does not support [GitHub projects (classic)](https://docs.github.com/en/issues/organizing-your-work-with-project-boards)*.
_The main difference between this lib and others is that you can use a PAT with repo and project scopes instead of org scope._

## Usage

_See [action.yml](action.yml) for [metadata](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions) that defines the inputs, outputs, and runs configuration for this action._

_For more information about workflows, see [Using workflows](https://docs.github.com/en/actions/using-workflows)._

Create a workflow that will be triggered on Issues or Pull Requests events. It is highly recommended to use [add-to-project](https://github.com/actions/add-to-project) action before in order to find/create an item in your project and then send the itemId as input to `update-project-fields`.

Once you've configured your workflow, save it as a `.yml` file in your target Repository's `.github/workflows` directory.

### Example

#### Example Usage: Issue opened with labels `bug` OR `needs-triage`

```yaml
name: Create and/or Update edited issues to my project

on:
  issues:
    types:
      - edited

jobs:
  create-update-project:
    name: Add issue to project
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/add-to-project@v0.3.0 # This adds the issue to the project
        with:
          project-url: https://github.com/users/titoportas/projects/2
          github-token: ${{ secrets.GHPROJECT_SECRET }}
        id: add-project
      - uses: titoportas/update-project-fields@v0.1.0
        with:
          project-url: https://github.com/users/titoportas/projects/2
          github-token: ${{ secrets.GHPROJECT_SECRET }}
          item-id: ${{ steps.add-project.outputs.itemId }} # Use the item-id output of the previous step
          field-keys: TextField,NumberField,FinishedAt,Size,IterationField
          field-values: foo,123,2022-09-01,🐋 X-Large,[1]
```

## Inputs

- <a name="project-url">`project-url`</a> **(required)** is the URL of the GitHub project to add issues to.
  _eg: `https://github.com/orgs|users/<ownerName>/projects/<projectNumber>`_
- <a name="github-token">`github-token`</a> **(required)** is a [personal access
  token](https://github.com/settings/tokens/new) with `repo` and `project` scopes.
  _See [Creating a PAT and adding it to your repository](#creating-a-pat-and-adding-it-to-your-repository) for more details_
- <a name="item-id">`item-id`</a> **(required)** project item id to be updated. Important: this id is not the issue/pull_request number.
- <a name="field-keys">`field-keys`</a> **(required)** the github project field names separated with `,`.
- <a name="field-values">`field-values`</a> **(required)** the github project field values associated to the `field-keys` separated with `,`. If the key has values with special characters (_eg: ✅ Done) you must include them.

## Creating a PAT and adding it to your repository

- create a new [personal access
  token](https://github.com/settings/tokens/new) with `repo` and `project` scopes
  _See [Creating a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) for more information_

- add the newly created PAT as a repository secret, this secret will be referenced by the [github-token input](#github-token)
  _See [Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository) for more information_

## Development

To get started contributing to this project, clone it and install dependencies.
Note that this action runs in Node.js 16.x, so we recommend using that version
of Node (see "engines" in this action's package.json for details).

```shell
> git clone https://github.com/titoportas/update-project-fields.git
> cd update-project-fields
> npm install
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Special mentions
I want to say thanks to the authors and contributors of [add-to-project](https://github.com/actions/add-to-project) and [project-update](https://github.com/austenstone/project-update). This Github action is based on both github projects.