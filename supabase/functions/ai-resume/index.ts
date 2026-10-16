import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service is not configured." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    if (
      typeof documentType !== "string" ||
      !documentType.trim() ||
      typeof rawData !== "string" ||
      !rawData.trim() ||
      rawData.length > 24000
    ) {
      return new Response(
        JSON.stringify({ error: "Document details are missing or exceed the supported length." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const deepSeekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
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

    if (!deepSeekResponse.ok) {
      console.error("[ai-resume] DeepSeek request failed:", deepSeekResponse.status)
      return new Response(
        JSON.stringify({ error: "Resume generation is temporarily unavailable. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

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