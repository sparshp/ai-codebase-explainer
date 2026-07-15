export interface IngestRepoBody { url: string; branch?: string }
export interface RepoStatusResponse {
  jobId:    string
  repoId:   string
  status:   string
  progress: number
  error?:   string
}