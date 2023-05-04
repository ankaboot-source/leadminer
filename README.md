[![Build & Deploy](https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy-demo.yml/badge.svg)](https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy-demo.yml) [![DeepSource](https://deepsource.io/gh/ankaboot-source/leadminer.svg/?label=active+issues&show_trend=true&token=M4B7pZCjFk2wl_EJpgQ9f-le)](https://deepsource.io/gh/ankaboot-source/leadminer/?ref=repository-badge) </a>[![Maintainability](https://api.codeclimate.com/v1/badges/42e68c56bc3ce2b1f59b/maintainability)](https://codeclimate.com/repos/63f7174b3d043100a803ee03/maintainability)

# ⛏ Leadminer

Leadminer is a tool to mine and transmute raw and passive contacts from your own communication tools (email mailbox, social networks) into actionable and qualified leads.

## Self-hosting and running Leadminer

Docker is the recommended solution for self-hosting Leadminer thanks to its convenience and ease of use.

### Run Leadminer using docker-compose

1. Clone the repository and enter `leadminer` folder

1. Copy [.env.example](/.env.example) to `.env` and add the missing required environment variables:

   - Supabase project url : `SUPABASE_PROJECT_URL`
   - Supabase project token : `SUPABASE_SECRET_PROJECT_TOKEN`
   - Postgres connection string : `PG_CONNECTION_STRING`
   - Google client Id : `GOOGLE_CLIENT_ID`
   - Google secret: `GOOGLE_SECRET`

```sh
cp .env.example .env
```

3. Start docker-compose:

```sh
docker-compose up --build --force-recreate
```

4. Navigate to `localhost:8080`.

## Support

If you have any trouble, check the [issues tab](https://github.com/ankaboot-source/leadminer/issues). We might already have reported/fixed the problem. Make sure you're on the latest version. If your problem persists, feel free to open a new issue.

This app is provided for free as such with no guarantee nor support. For any kind of support, feel free to reach [ankaboot professional services](contact@ankaboot.fr).

## Roadmap

- [ ] New sources : LinkedIn, Instagram, Facebook Messenger
- [ ] Enrich data : Get more relevant and actionable information about your contacts
- [ ] Marketing automation : send emails directly from LeadMiner with personalized templates

For any requests concerning the roadmap, you could either have a look on issues or for any specific request contact [ankaboot professional services](contact@ankaboot.fr).

## Contributing

### Run Leadminer locally

You can easily get started with development mode by following theses steps:

1. Install the required dependencies

```sh
npm run install-deps
```

1. Start supabase services and take note of the supabase project token to use it in the next step.

```sh
# Start supabase services
npm run dev:supabase
```

2. Copy `/frontend/.env.example` to `/frontend/.env` and `/backend/.env.example` to `/backend/.env` respectively and set the missing required variables

1. Start your environment by running the following commands:

```sh
# Start the Redis container  -- You can skip this step if you want to use your local instance
docker-compose -f docker-compose.dev.yml up

# Start the backend in development mode
npm run dev:backend-api
npm run dev:backend-worker

# Start the frontend in development mode
npm run dev:frontend
```

### Generating a new migration for schema changes

- When altering the database schema or creating new tables, functions..., make sure to run these commands (While supabase services are up):

```sh
# Start supabase services
npx supabase start

# Make your changes from supabase studio

# List the changes that you made
npx supabase db diff --use-migra

# Create a migration for the changes that you have made
npx supabase db diff --use-migra -f <name_of_migration>

# Stop supabase services once you're done
npx supabase stop
```

### General guidelines

Please feel free to contribute. Pull requests are welcome.

1. Fork this [repository](https://github.com/ankaboot-source/leadminer)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request

For major changes, please open an issue first to discuss what you would like to change.

_Make sure to update/create tests as appropriate._

## License

This software is [dual-licensed](DUAL-LICENSE.md) under [GNU AGPL v3](LICENSE).
