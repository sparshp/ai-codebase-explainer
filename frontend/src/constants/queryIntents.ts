export type QueryIntent = 'LOOKUP' | 'ARCHITECTURE' | 'DEBUG' | 'FLOW'

export const INTENT_MODES: Array<{
  id:          QueryIntent
  label:       string
  description: string
  color:       string
  bg:          string
  border:      string
  prompts:     string[]
}> = [
  {
    id:          'LOOKUP',
    label:       'Lookup',
    description: 'Find where something lives',
    color:       '#085041',
    bg:          '#E1F5EE',
    border:      '#5DCAA5',
    prompts: [
      'Which file contains the authentication middleware?',
      'Where is the repo ingestion job started?',
      'Find the function that connects to Redis.',
    ],
  },
  {
    id:          'ARCHITECTURE',
    label:       'Architecture',
    description: 'How systems connect',
    color:       '#3C3489',
    bg:          '#EEEDFE',
    border:      '#AFA9EC',
    prompts: [
      'Explain how authentication and routing work in this repo.',
      'How does the chat RAG pipeline retrieve and answer questions?',
      'What are the main modules and how do they interact?',
    ],
  },
  {
    id:          'FLOW',
    label:       'Flow',
    description: 'Step-by-step execution',
    color:       '#0C447C',
    bg:          '#E6F1FB',
    border:      '#85B7EB',
    prompts: [
      'Walk through the signup and sign-in flow step by step.',
      'Trace what happens when a repo is ingested end to end.',
      'What happens when a user sends a chat question?',
    ],
  },
  {
    id:          'DEBUG',
    label:       'Debug',
    description: 'Diagnose bugs & failures',
    color:       '#993C1D',
    bg:          '#FAECE7',
    border:      '#F5C4B3',
    prompts: [
      'Why does login fail with a socket hang up or ECONNREFUSED?',
      'What could cause an ingestion job to fail after embeddings?',
      'Why might citations be empty even when the answer mentions files?',
      'What causes high chat latency and how can it be improved?',
    ],
  },
]
