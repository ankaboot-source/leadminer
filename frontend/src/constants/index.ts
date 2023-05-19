import { provider } from "src/types/providers";

export const oauthProviders: provider[] = [
  {
    name: 'google',
    domains: ['gmail', 'googlemail.com', 'google.com']
  },
  {
    name: 'azure',
    domains: ['outlook', 'hotmail', 'live', 'msn']
  },
]

