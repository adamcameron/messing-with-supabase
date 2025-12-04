import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, supabaseKey)
const queueName = 'testq'
// Type definition for queue messages
interface QueueMessage {
  msg_id: bigint
  read_ct: number
  vt: string
  enqueued_at: string
  message: any
}
async function processMessage(message: QueueMessage) {

   const { data, error, status } = await supabase.from('processed_messages').insert({message:message.message.message})

   if (status !== 201) {
    throw error
   }

  // Delete the message from the queue
  const { error: deleteError } = await supabase.schema('pgmq_public').rpc('delete', {
    queue_name: queueName,
    message_id: message.msg_id,
  })
  if (deleteError) {
    console.error(`Failed to delete message ${message.msg_id}:`, deleteError)
  } else {
    console.log(`Message ${message.msg_id} deleted from queue`)
  }
}


Deno.serve(async (req) => {
  const { count } = await req.json()

  const { data: messages, error } = await supabase.schema('pgmq_public').rpc('read', {
    queue_name: queueName,
    sleep_seconds: 0, // Don't wait if queue is empty
    n: count,
  })

  if (error) {
    console.error(`Error reading from ${queueName} queue:`, error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!messages || messages.length === 0) {
    console.log('No messages in testq queue')
    return new Response(JSON.stringify({ message: 'No messages in queue' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log(`Found ${messages.length} messages to process`)
  // Process each message that was read off the queue
  for (const message of messages) {
    try {
      await processMessage(message as QueueMessage)
    } catch (error) {
      console.error(`Error processing message ${message.msg_id}:`, error)
    }
  }

  // Return immediately while background processing continues
  return new Response(
    JSON.stringify({
      message: `Processing ${messages.length} messages in background`,
      count: messages.length,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
})

/* To invoke locally:

1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
2. Make an HTTP request:

curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/process-testq' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --header 'Content-Type: application/json' \
  --data '{"count": 10}'
*/
