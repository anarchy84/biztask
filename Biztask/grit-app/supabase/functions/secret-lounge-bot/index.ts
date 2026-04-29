import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { handleEngineRequest, runSecretLoungeBot } from '../_shared/activity-engine.ts'

serve((request) =>
  handleEngineRequest(request, 'secret-lounge-bot', ({ client, dryRun }) => runSecretLoungeBot(client, { dryRun }))
)
