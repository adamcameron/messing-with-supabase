import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js'

console.log("add-to-testq called")

Deno.serve(async (req) => {

  const queues = createClient(
    "http://host.docker.internal:54321",
    "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
    {db: { schema: 'pgmq_public' }}
  )

  const { prefix, count } = await req.json()

  console.dir({ prefix, count })

  const results = []

  for (let i=1; i <= count; i++){
    let message = {
      message: `${prefix} ${i}`,
    }
    let { data, error } = await queues.rpc('send', {
      queue_name: 'testq',
      message: message,
    })
    let result = data !== null
        ? {status:200, payload:data}
        : {status:500, payload:error}

    console.dir(result)
    results.push(result)
  }

  return new Response(
    JSON.stringify(results),
    {headers: { "Content-Type": "application/json" } },
  )
})

/* To invoke locally:

1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
2. Make an HTTP request:

curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/add-to-testq' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --header 'Content-Type: application/json' \
  --data '{"prefix":"test_prefix", "count": 100}'

*/
