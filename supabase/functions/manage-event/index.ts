// supabase/functions/manage-event/index.ts
// Consolidates: create event + auto RSVP, update RSVP (upsert), delete event + attendees → 1 call
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    if (!userId) {
      return createErrorResponse('Unauthorized', 401);
    }

    const body = await req.json();
    const { action } = body;

    if (!action || !['create', 'rsvp', 'delete'].includes(action)) {
      return createErrorResponse('action must be "create", "rsvp", or "delete"', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── CREATE EVENT ─────────────────────────────────────
    if (action === 'create') {
      const { group_id, title, description, start_date, end_date, location, is_online, max_attendees } = body;

      if (!group_id || !title || !start_date) {
        return createErrorResponse('group_id, title, and start_date are required', 400);
      }

      const { data: eventData, error: eventError } = await supabase
        .from('social_events')
        .insert({
          title,
          description: description || null,
          group_id,
          organizer_id: userId,
          start_date,
          end_date: end_date || new Date(new Date(start_date).getTime() + 2 * 60 * 60 * 1000).toISOString(),
          location: location || null,
          is_online: is_online || false,
          max_attendees: max_attendees || null
        })
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to create event: ${eventError.message}`);
      }

      // Auto-RSVP the organizer
      await supabase.from('social_event_attendees').insert({
        event_id: eventData.id,
        user_id: userId,
        status: 'attending'
      });

      return new Response(
        JSON.stringify({ success: true, event: eventData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── RSVP ─────────────────────────────────────────────
    if (action === 'rsvp') {
      const { event_id, status } = body;

      if (!event_id || !status) {
        return createErrorResponse('event_id and status are required', 400);
      }

      if (!['attending', 'maybe', 'declined'].includes(status)) {
        return createErrorResponse('status must be "attending", "maybe", or "declined"', 400);
      }

      // Check for existing attendance record
      const { data: existing } = await supabase
        .from('social_event_attendees')
        .select('id')
        .eq('event_id', event_id)
        .eq('user_id', userId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('social_event_attendees')
          .update({ status })
          .eq('id', existing.id);

        if (error) throw new Error(`Failed to update RSVP: ${error.message}`);
      } else {
        const { error } = await supabase
          .from('social_event_attendees')
          .insert({ event_id, user_id: userId, status });

        if (error) throw new Error(`Failed to create RSVP: ${error.message}`);
      }

      return new Response(
        JSON.stringify({ success: true, status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── DELETE EVENT ─────────────────────────────────────
    if (action === 'delete') {
      const { event_id } = body;

      if (!event_id) {
        return createErrorResponse('event_id is required', 400);
      }

      // Verify user is the organizer
      const { data: event } = await supabase
        .from('social_events')
        .select('organizer_id')
        .eq('id', event_id)
        .single();

      if (!event) {
        return createErrorResponse('Event not found', 404);
      }

      if (event.organizer_id !== userId) {
        return createErrorResponse('Only the organizer can delete the event', 403);
      }

      // Delete attendees then event
      await supabase.from('social_event_attendees').delete().eq('event_id', event_id);
      const { error } = await supabase.from('social_events').delete().eq('id', event_id);

      if (error) {
        throw new Error(`Failed to delete event: ${error.message}`);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in manage-event:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
