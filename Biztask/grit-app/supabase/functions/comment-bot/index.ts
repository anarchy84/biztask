import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { handleEngineRequest, runCommentBot } from '../_shared/activity-engine.ts'

serve((request) =>
  handleEngineRequest(
    request,
    'comment-bot',
    ({ client, dryRun }) => runCommentBot(client, { surface: 'feed', dryRun }),
  )
)
