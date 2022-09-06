import * as core from '@actions/core'
import {updateProject} from './update-project-fields'

updateProject()
  .catch(err => {
    core.setFailed(err.message)
    process.exit(1)
  })
  .then(() => {
    process.exit(0)
  })
