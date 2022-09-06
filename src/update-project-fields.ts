import * as core from '@actions/core'
import * as github from '@actions/github'
import {Octokit} from '@octokit/core'

// TODO: Ensure this (and the Octokit client) works for non-github.com URLs, as well.
// https://github.com/orgs|users/<ownerName>/projects/<projectNumber>
const urlParse =
  /^(?:https:\/\/)?github\.com\/(?<ownerType>orgs|users)\/(?<ownerName>[^/]+)\/projects\/(?<projectNumber>\d+)/

interface ProjectNodeIDResponse {
  organization?: {
    projectV2: {
      id: string
    }
  }

  user?: {
    projectV2: {
      id: string
    }
  }
}

interface ProjectFieldIteration {
  id: string
  startDate: string
}

interface ProjectFieldData {
  id: string
  name: string
  dataType: string
  options?: [
    {
      id: string
      name: string
    }
  ]
  configuration?: {
    iterations: [ProjectFieldIteration]
  }
}

interface ProjectFieldsResponse {
  node: {
    fields: {
      nodes: [ProjectFieldData]
    }
  }
}

interface ProjectUpdateFieldItemResponse {
  updateProjectV2ItemFieldValue: {
    projectV2Item: {
      id: string
    }
  }
}

interface FieldsToUpdate {
  [key: string]: string
}

function getInputItemId(): string {
  return core.getInput('item-id', {required: true})
}

export function getFields(): FieldsToUpdate {
  const fieldKeys = core.getInput('field-keys', {required: true})
  const fieldValues = core.getInput('field-values', {required: true})
  const valuesArray = fieldValues.split(',')
  return fieldKeys.split(',').reduce((obj: {[key: string]: any}, f, i) => {
    if (valuesArray[i]) {
      obj[f] = valuesArray[i]
    }
    return obj
  }, {})
}

async function getProject(octokit: Octokit): Promise<string> {
  const projectUrl = core.getInput('project-url', {required: true})

  const urlMatch = projectUrl.match(urlParse)

  if (!urlMatch) {
    throw new Error(
      `Invalid project URL: ${projectUrl}. Project URL should match the format https://github.com/<orgs-or-users>/<ownerName>/projects/<projectNumber>`
    )
  }

  const projectOwnerName = urlMatch.groups?.ownerName
  const projectNumber = parseInt(urlMatch.groups?.projectNumber ?? '', 10)
  const ownerType = urlMatch.groups?.ownerType
  const ownerTypeQuery = mustGetOwnerTypeQuery(ownerType)

  // First, use the GraphQL API to request the project's node ID.
  const idResp = await octokit.graphql<ProjectNodeIDResponse>(
    `query getProject($projectOwnerName: String!, $projectNumber: Int!) {
      ${ownerTypeQuery}(login: $projectOwnerName) {
        projectV2(number: $projectNumber) {
          id
        }
      }
    }`,
    {
      projectOwnerName,
      projectNumber
    }
  )

  const projectId = idResp[ownerTypeQuery]?.projectV2.id

  return projectId as string
}

function getOctokitCli(): Octokit {
  const ghToken = core.getInput('github-token', {required: true})
  return github.getOctokit(ghToken)
}

export async function updateProject(): Promise<void> {
  const octokit: Octokit = getOctokitCli()
  const itemId: string = getInputItemId()
  const fieldsMap: FieldsToUpdate = getFields()
  const projectId: string = await getProject(octokit)
  if (Object.keys(fieldsMap).length > 0) {
    const projectFields: ProjectFieldsResponse = await octokit.graphql<ProjectFieldsResponse>(
      `query getProjectFields($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 100) {
              nodes {
                ... on ProjectV2Field {
                  id
                  dataType
                  name
                }
                ... on ProjectV2IterationField {
                  id
                  name
                  dataType
                  configuration {
                    iterations {
                      startDate
                      id
                    }
                  }
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }`,
      {
        projectId
      }
    )

    const fieldNodes = projectFields.node.fields.nodes
    for (const key of Object.keys(fieldsMap)) {
      let value: any = fieldsMap[key]
      const field = fieldNodes.find(node => key === node.name)
      if (!field) {
        core.info(`Failed to find field with name '${key}'.`)
        continue
      }

      if (field.options) {
        let option
        if (value.startsWith('[') && value.endsWith(']')) {
          const index = parseInt(value.slice(1, -1))
          if (!isNaN(index)) {
            option = field.options[index]
          }
        } else {
          option = field.options.find(o => o.name.toLowerCase() === value.toLowerCase())
        }
        if (option) {
          value = option.id
        }
      } else if (field.configuration?.iterations) {
        let iteration
        if (value.startsWith('[') && value.endsWith(']')) {
          const index = parseInt(value.slice(1, -1))
          if (!isNaN(index)) {
            iteration = field.configuration.iterations[index]
          }
        } else {
          iteration = field.configuration.iterations.find(i => i.startDate.toLowerCase() === value.toLowerCase())
        }
        if (iteration) {
          value = iteration.id
        }
      }

      const updateFieldKey = getUpdateFieldValueKey(field.dataType)
      if (updateFieldKey === 'number') {
        value = parseFloat(value)
      }

      try {
        const updatedItem: ProjectUpdateFieldItemResponse = await octokit.graphql<ProjectUpdateFieldItemResponse>(
          `mutation updateProjectV2ItemFieldValue($input: UpdateProjectV2ItemFieldValueInput!) {
            updateProjectV2ItemFieldValue(input: $input) {
              projectV2Item {
                id
              }
            }
          }`,
          {
            input: {
              projectId,
              itemId,
              fieldId: field.id,
              value: {
                [updateFieldKey]: value
              }
            }
          }
        )
        core.info(
          `Successfully updated field '${key}' with value '${value}' for item: ${updatedItem.updateProjectV2ItemFieldValue.projectV2Item.id}.`
        )
      } catch (err) {
        core.info(`Failed to update field '${key}' with value '${value}'. ${JSON.stringify(err, null, 2)}`)
      }
    }
  }
}

export function mustGetOwnerTypeQuery(ownerType?: string): 'organization' | 'user' {
  const ownerTypeQuery = ownerType === 'orgs' ? 'organization' : ownerType === 'users' ? 'user' : null

  if (!ownerTypeQuery) {
    throw new Error(`Unsupported ownerType: ${ownerType}. Must be one of 'orgs' or 'users'`)
  }

  return ownerTypeQuery
}

export function getUpdateFieldValueKey(
  fieldDataType: string
): 'text' | 'number' | 'date' | 'singleSelectOptionId' | 'iterationId' {
  if (fieldDataType === 'TEXT') {
    return 'text'
  } else if (fieldDataType === 'NUMBER') {
    return 'number'
  } else if (fieldDataType === 'DATE') {
    return 'date'
  } else if (fieldDataType === 'ITERATION') {
    return 'iterationId'
  } else if (fieldDataType === 'SINGLE_SELECT') {
    return 'singleSelectOptionId'
  } else {
    throw new Error(
      `Unsupported dataType: ${fieldDataType}. Must be one of 'text', 'number', 'date', 'singleSelectOptionId', 'iterationId'`
    )
  }
}
