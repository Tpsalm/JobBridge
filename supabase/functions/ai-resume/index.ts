import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { geminiChat, GeminiRequestError, type GeminiMessage } from "../_shared/gemini.ts";

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

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('subscription_tier, subscription_expires_at')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (
      profile?.subscription_tier !== 'ai_tools' ||
      !profile.subscription_expires_at ||
      new Date(profile.subscription_expires_at).getTime() <= Date.now()
    ) {
      return new Response(
        JSON.stringify({ error: "An active AI Career Tools subscription is required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { documentType, rawData } = await req.json()
    const messages: GeminiMessage[] = [
      { role: 'system', content: `You are an expert ATS-optimized ${documentType} builder. Generate professional Markdown and do not invent facts.` },
      { role: 'user', content: `Create a professional ${documentType} based only on these details: ${rawData}` },
    ]
    const generatedText = (await geminiChat(messages)).content

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
    const status = error instanceof GeminiRequestError
      ? error.status
      : error instanceof Error && error.message === 'Unauthorized'
        ? 401
        : 500
    return new Response(
      JSON.stringify({ error: error instanceof GeminiRequestError ? error.message : 'Resume generation failed. Please try again.' }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})