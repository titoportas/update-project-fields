import * as core from '@actions/core'
import * as github from '@actions/github'
import * as updateToProject from '../src/update-project-fields'

describe('updateProject', () => {
  beforeEach(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    github.context.payload = {}
    jest.restoreAllMocks()
  })

  test('Updates item-id field key-value', async () => {
    mockGetInput({
      'project-url': 'https://github.com/users/titoportas/projects/1',
      'github-token': 'gh_token',
      'item-id': 'project-item-id',
      'field-keys': 'field-text',
      'field-values': 'field-value'
    })

    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'bug'}],
        // eslint-disable-next-line camelcase
        html_url: 'https://github.com/titoportas/update-project/issues/74'
      },
      repository: {
        name: 'update-project',
        owner: {
          login: 'titoportas'
        }
      }
    }

    mockGraphQL(
      {
        test: /getProject\(/,
        return: {
          organization: {
            projectV2: {
              id: 'project-id'
            }
          }
        }
      },
      {
        test: /getProjectFields\(/,
        return: {
          node: {
            fields: {
              nodes: [
                {
                  id: 'field-text-id',
                  name: 'field-text',
                  dataType: 'TEXT'
                }
              ]
            }
          }
        }
      },
      {
        test: /updateProjectV2ItemFieldValue\(/,
        return: {
          updateProjectV2ItemFieldValue: {
            projectV2Item: {
              id: 'project-item-id'
            }
          }
        }
      }
    )

    const infoSpy = jest.spyOn(core, 'info')

    await updateToProject.updateProject()

    expect(infoSpy).toHaveBeenCalledWith(
      `Successfully updated field 'field-text' with value 'field-value' for item: project-item-id.`
    )
  })

  test('Updates item-id field key-value only if field key exists in project', async () => {
    mockGetInput({
      'project-url': 'https://github.com/users/titoportas/projects/1',
      'github-token': 'gh_token',
      'item-id': 'project-item-id',
      'field-keys': 'unknown-field,field-text',
      'field-values': 'unknown-value,field-value'
    })

    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'bug'}],
        // eslint-disable-next-line camelcase
        html_url: 'https://github.com/titoportas/update-project/issues/74'
      },
      repository: {
        name: 'update-project',
        owner: {
          login: 'titoportas'
        }
      }
    }

    mockGraphQL(
      {
        test: /getProject\(/,
        return: {
          organization: {
            projectV2: {
              id: 'project-id'
            }
          }
        }
      },
      {
        test: /getProjectFields\(/,
        return: {
          node: {
            fields: {
              nodes: [
                {
                  id: 'field-text-id',
                  name: 'field-text',
                  dataType: 'TEXT'
                }
              ]
            }
          }
        }
      },
      {
        test: /updateProjectV2ItemFieldValue\(/,
        return: {
          updateProjectV2ItemFieldValue: {
            projectV2Item: {
              id: 'project-item-id'
            }
          }
        }
      }
    )

    const infoSpy = jest.spyOn(core, 'info')

    await updateToProject.updateProject()

    expect(infoSpy).toHaveBeenCalledWith(
      `Successfully updated field 'field-text' with value 'field-value' for item: project-item-id.`
    )
    expect(infoSpy).toHaveBeenCalledWith(`Failed to find field with name 'unknown-field'.`)
  })

  test('Will not update if no item-id as input', async () => {
    mockGetInput({
      'project-url': 'https://github.com/users/titoportas/projects/1',
      'github-token': 'gh_token',
      'field-keys': 'unknown-field,field-text',
      'field-values': 'unknown-value,field-value'
    })

    github.context.payload = {
      issue: {
        number: 1,
        labels: [{name: 'bug'}],
        // eslint-disable-next-line camelcase
        html_url: 'https://github.com/titoportas/update-project/issues/74'
      },
      repository: {
        name: 'update-project',
        owner: {
          login: 'titoportas'
        }
      }
    }

    mockGraphQL(
      {
        test: /getProject\(/,
        return: {
          organization: {
            projectV2: {
              id: 'project-id'
            }
          }
        }
      },
      {
        test: /getProjectFields\(/,
        return: {
          node: {
            fields: {
              nodes: [
                {
                  id: 'field-text-id',
                  name: 'field-text',
                  dataType: 'TEXT'
                }
              ]
            }
          }
        }
      },
      {
        test: /updateProjectV2ItemFieldValue\(/,
        return: {
          updateProjectV2ItemFieldValue: {
            projectV2Item: {
              id: 'project-item-id'
            }
          }
        }
      }
    )

    const infoSpy = jest.spyOn(core, 'info')

    await updateToProject.updateProject()

    expect(infoSpy).toHaveBeenCalledWith(
      `Successfully updated field 'field-text' with value 'field-value' for item: project-item-id.`
    )
    expect(infoSpy).toHaveBeenCalledWith(`Failed to find field with name 'unknown-field'.`)
  })
})

describe('getFields', () => {
  afterEach(() => {
    github.context.payload = {}
    jest.restoreAllMocks()
  })

  test('returns empty object for empty field-keys, field-values', async () => {
    mockGetInput({
      'field-keys': '',
      'field-values': ''
    })
    const fieldMap = updateToProject.getFields()
    expect(fieldMap).toEqual({})
  })

  test('returns object for field-keys, field-values', async () => {
    mockGetInput({
      'field-keys': 'key1',
      'field-values': 'value1'
    })
    const fieldMap = updateToProject.getFields()
    expect(fieldMap).toEqual({key1: 'value1'})
  })

  test('returns object with skipped key when it has an empty associated value', async () => {
    mockGetInput({
      'field-keys': 'key1,key2,key3',
      'field-values': 'value1,,value3'
    })
    const fieldMap = updateToProject.getFields()
    expect(fieldMap).toEqual({key1: 'value1', key3: 'value3'})
  })

  test('returns object with skipped values when number of keys is less than number of values', async () => {
    mockGetInput({
      'field-keys': 'key1,key2',
      'field-values': 'value1,value2,value3'
    })
    const fieldMap = updateToProject.getFields()
    expect(fieldMap).toEqual({key1: 'value1', key2: 'value2'})
  })
})

describe('getUpdateFieldValueKey', () => {
  test('returns number for NUMBER fieldKey', async () => {
    const fieldKey = updateToProject.getUpdateFieldValueKey('NUMBER')

    expect(fieldKey).toEqual('number')
  })

  test('returns text for TEXT fieldKey', async () => {
    const fieldKey = updateToProject.getUpdateFieldValueKey('TEXT')

    expect(fieldKey).toEqual('text')
  })

  test('returns date for DATE fieldKey', async () => {
    const fieldKey = updateToProject.getUpdateFieldValueKey('DATE')

    expect(fieldKey).toEqual('date')
  })

  test('returns iterationId for ITERATION fieldKey', async () => {
    const fieldKey = updateToProject.getUpdateFieldValueKey('ITERATION')

    expect(fieldKey).toEqual('iterationId')
  })

  test('returns text for SINGLE_SELECT fieldKey', async () => {
    const fieldKey = updateToProject.getUpdateFieldValueKey('SINGLE_SELECT')

    expect(fieldKey).toEqual('singleSelectOptionId')
  })

  test('throws an error when an unsupported fieldKey is set', async () => {
    expect(() => {
      updateToProject.getUpdateFieldValueKey('unknown')
    }).toThrow(
      `Unsupported dataType: unknown. Must be one of 'text', 'number', 'date', 'singleSelectOptionId', 'iterationId'`
    )
  })
})

describe('mustGetOwnerTypeQuery', () => {
  test('returns organization for orgs ownerType', async () => {
    const ownerTypeQuery = updateToProject.mustGetOwnerTypeQuery('orgs')

    expect(ownerTypeQuery).toEqual('organization')
  })

  test('returns user for users ownerType', async () => {
    const ownerTypeQuery = updateToProject.mustGetOwnerTypeQuery('users')

    expect(ownerTypeQuery).toEqual('user')
  })

  test('throws an error when an unsupported ownerType is set', async () => {
    expect(() => {
      updateToProject.mustGetOwnerTypeQuery('unknown')
    }).toThrow(`Unsupported ownerType: unknown. Must be one of 'orgs' or 'users'`)
  })
})

function mockGetInput(mocks: Record<string, string>): jest.SpyInstance {
  const mock = (key: string) => mocks[key] ?? ''
  return jest.spyOn(core, 'getInput').mockImplementation(mock)
}

function mockGraphQL(...mocks: {test: RegExp; return: unknown}[]): jest.Mock {
  const mock = jest.fn().mockImplementation((query: string) => {
    const match = mocks.find(m => m.test.test(query))

    if (match) {
      return match.return
    }

    throw new Error(`Unexpected GraphQL query: ${query}`)
  })

  jest.spyOn(github, 'getOctokit').mockImplementation(() => {
    return {
      graphql: mock
    } as unknown as ReturnType<typeof github.getOctokit>
  })

  return mock
}
