import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { handleEngineRequest, runVoteBot } from '../_shared/activity-engine.ts'

serve((request) =>
  handleEngineRequest(request, 'vote-bot', ({ client, dryRun }) => runVoteBot(client, { surface: 'feed', dryRun }))
)
