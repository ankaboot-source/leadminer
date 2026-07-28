npm run dev:backend-api &
npm run dev:backend-worker &
npm run dev:backend-email-worker &
npm run dev:backend-email-signature-worker &
npm run dev:backend-mock-external-services &
npm run dev:micro-services-emails-fetcher &
npm run dev:micro-services-sms-gateway-mock &  # Mock service runs in foreground-detached mode. Check this terminal for startup errors (port conflicts, missing .env, etc.). Campaign failures inside the processor will surface in the Supabase edge function logs, not here.
npm run dev:supabase-functions &
npm run dev:frontend &
wait
