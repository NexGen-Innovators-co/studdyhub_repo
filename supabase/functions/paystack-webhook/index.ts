import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();
    
    // Verify webhook signature
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      console.error('PAYSTACK_SECRET_KEY not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    // Create HMAC signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(body);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== computedSignature) {
      console.error('Invalid webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);
    console.log('Paystack webhook event:', event.event);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (event.event) {
      case 'subscription.create': {
        const { customer, subscription_code, plan, status } = event.data;
        const planType = plan.name.toLowerCase().includes('genius') ? 'genius' : 'scholar';
        
        // Find user by email
        const { data: userData } = await supabase.auth.admin.listUsers();
        const user = userData?.users.find(u => u.email === customer.email);
        
        if (user) {
          await supabase.from('subscriptions').upsert({
            user_id: user.id,
            plan_type: planType,
            status: status === 'active' ? 'active' : 'past_due',
            paystack_sub_code: subscription_code,
            paystack_customer_code: customer.customer_code,
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: 'user_id' });
          
          console.log(`Subscription created for user ${user.id}`);
        }
        break;
      }

      case 'subscription.disable':
      case 'subscription.not_renew': {
        const { subscription_code } = event.data;
        
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('paystack_sub_code', subscription_code);
        
        console.log(`Subscription cancelled: ${subscription_code}`);
        break;
      }

      case 'charge.success': {
        const { customer, reference, metadata } = event.data;
        
        if (metadata?.plan_type) {
          // Find user by email
          const { data: userData } = await supabase.auth.admin.listUsers();
          const user = userData?.users.find(u => u.email === customer.email);
          
          if (user) {
            await supabase.from('subscriptions').upsert({
              user_id: user.id,
              plan_type: metadata.plan_type,
              status: 'active',
              paystack_sub_code: reference,
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }, { onConflict: 'user_id' });
            
            console.log(`Charge successful for user ${user.id}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const { subscription } = event.data;
        
        if (subscription?.subscription_code) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('paystack_sub_code', subscription.subscription_code);
          
          console.log(`Payment failed for subscription: ${subscription.subscription_code}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
