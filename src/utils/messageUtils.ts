// utils/messageUtils.ts
import { supabase } from '../integrations/supabase/client';

export const markMessageAsDisplayed = async (messageId: string) => {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .update({ has_been_displayed: true })
      .eq('id', messageId);

    if (error) throw error;
    return true;
  } catch (error) {
    //console.error('Error marking message as displayed:', error);
    return false;
  }
};