// Supabase Edge Function: Increment unique podcast listen
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { podcast_id, user_id } = req.body;
  if (!podcast_id || !user_id) {
    return res.status(400).json({ error: "Missing podcast_id or user_id" });
  }

  // Only insert if not exists (unique user_id + podcast_id)
  const { data: existing, error: checkError } = await supabase
    .from("podcast_listeners")
    .select("id")
    .eq("podcast_id", podcast_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (checkError) {
    return res.status(500).json({ error: checkError.message });
  }

  if (!existing) {
    // Insert new listen and increment count
    const { error: insertError } = await supabase
      .from("podcast_listeners")
      .insert({ podcast_id, user_id, joined_at: new Date().toISOString() });
    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }
    const { error: updateError } = await supabase.rpc("increment_podcast_listen_count", { podcast_id });
    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }
    return res.status(200).json({ success: true });
  } else {
    // Already exists, do nothing
    return res.status(200).json({ alreadyListened: true });
  }
}
