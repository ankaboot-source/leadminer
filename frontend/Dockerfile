FROM node:lts-alpine as build-stage

ARG SERVER_ENDPOINT
ARG SUPABASE_PROJECT_URL
ARG SUPABASE_ANON_KEY
ARG IMAGE_REVERSE_PROXY
ARG AVERAGE_EXTRACTION_RATE
ARG POSTHOG_API_KEY
ARG POSTHOG_INSTANCE_ADDRESS
ARG ENABLE_CREDIT
ARG EXTERNAL_REFILL_CREDITS_LINK
ARG SAAS_SUPABASE_PROJECT_URL
ARG SAAS_SUPABASE_ANON_KEY

ENV SERVER_ENDPOINT ${SERVER_ENDPOINT}
ENV SUPABASE_PROJECT_URL ${SUPABASE_PROJECT_URL}
ENV SUPABASE_ANON_KEY ${SUPABASE_ANON_KEY}
ENV IMAGE_REVERSE_PROXY ${IMAGE_REVERSE_PROXY}
ENV AVERAGE_EXTRACTION_RATE ${AVERAGE_EXTRACTION_RATE}
ENV POSTHOG_API_KEY ${POSTHOG_API_KEY}
ENV POSTHOG_INSTANCE_ADDRESS ${POSTHOG_INSTANCE_ADDRESS}
ENV ENABLE_CREDIT ${ENABLE_CREDIT}
ENV EXTERNAL_REFILL_CREDITS_LINK ${EXTERNAL_REFILL_CREDITS_LINK}
ENV CREDITS_PER_CONTACT ${CREDITS_PER_CONTACT}
ENV SAAS_SUPABASE_PROJECT_URL ${SAAS_SUPABASE_PROJECT_URL}
ENV SAAS_SUPABASE_ANON_KEY ${SAAS_SUPABASE_ANON_KEY}


WORKDIR /frontend
COPY . .

RUN npm install && npm run build

EXPOSE 3000

CMD [ "node", ".output/server/index.mjs" ]
