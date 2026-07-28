import { serve } from "https://deno.land"
import { createClient } from "https://esm.sh"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apiKey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { documentType, rawData } = await req.json()
    
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY")
    const deepSeekResponse = await fetch("https://deepseek.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: `You are an expert ATS-optimized ${documentType} builder. Generate professional Markdown.` },
          { role: "user", content: `Create a professional ${documentType} based on this information: ${rawData}` }
        ],
        temperature: 0.7
      })
    })

    const deepSeekData = await deepSeekResponse.json()
    
    if (!deepSeekData.choices || deepSeekData.choices.length === 0) {
      throw new Error(deepSeekData.error?.message || "Failed to get data from DeepSeek")
    }
    
    const generatedText = deepSeekData.choices[0].message.content

    const { data, error: dbError } = await supabaseClient
      .from('generated_documents')
      .insert([
        { 
          user_id: user.id, 
          document_type: documentType, 
          content: generatedText 
        }
      ])
      .select()

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ success: true, data: data[0] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})