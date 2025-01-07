#!/bin/bash
npm run dev:backend-api &
npm run dev:backend-worker &
npm run dev:backend-email-worker &
npm run dev:backend-mock-external-services&
npm run dev:frontend &
wait
