import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { handleEngineRequest, runPostPublisher } from '../_shared/activity-engine.ts'

serve((request) =>
  handleEngineRequest(
    request,
    'post-publisher',
    ({ client, dryRun }) => runPostPublisher(client, { surface: 'feed', dryRun }),
  )
)
