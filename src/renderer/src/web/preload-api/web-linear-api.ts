import type { PreloadApi } from '../../../../preload/api-types'
import { callRuntimeResult } from './web-runtime-calls'
import { noopUnsubscribe } from './web-storage'

export function createWebLinearApi(): PreloadApi['linear'] {
  return {
    // Paired events belong to runtime-client-ipc-bridge; this listener is desktop IPC only.
    onLinkedIssueUpdated: () => noopUnsubscribe,
    connect: (args) => callRuntimeResult('linear.connect', args),
    disconnect: (args) => callRuntimeResult('linear.disconnect', args),
    selectWorkspace: (args) => callRuntimeResult('linear.selectWorkspace', args),
    status: () => callRuntimeResult('linear.status'),
    testConnection: (args) => callRuntimeResult('linear.testConnection', args),
    searchIssues: (args) => callRuntimeResult('linear.searchIssues', args),
    listIssues: (args) => callRuntimeResult('linear.listIssues', args),
    createIssue: (args) => callRuntimeResult('linear.createIssue', args),
    getIssue: (args) => callRuntimeResult('linear.getIssue', args),
    updateIssue: (args) => callRuntimeResult('linear.updateIssue', args),
    addIssueComment: (args) => callRuntimeResult('linear.addIssueComment', args),
    issueComments: (args) => callRuntimeResult('linear.issueComments', args),
    listTeams: (args) => callRuntimeResult('linear.listTeams', args),
    listProjects: (args) => callRuntimeResult('linear.listProjects', args),
    createProject: (args) => callRuntimeResult('linear.createProject', args),
    getProject: (args) => callRuntimeResult('linear.getProject', args),
    listProjectIssues: (args) => callRuntimeResult('linear.listProjectIssues', args),
    listCustomViews: (args) => callRuntimeResult('linear.listCustomViews', args),
    getCustomView: (args) => callRuntimeResult('linear.getCustomView', args),
    listCustomViewIssues: (args) => callRuntimeResult('linear.listCustomViewIssues', args),
    listCustomViewProjects: (args) => callRuntimeResult('linear.listCustomViewProjects', args),
    teamStates: (args) => callRuntimeResult('linear.teamStates', args),
    teamLabels: (args) => callRuntimeResult('linear.teamLabels', args),
    teamMembers: (args) => callRuntimeResult('linear.teamMembers', args)
  }
}
