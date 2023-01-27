[![Build & Deploy](https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy-demo.yml/badge.svg)](https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy-demo.yml)
<img src="https://img.shields.io/badge/Coverage-87.9%25-yellow.svg?style=flat" alt="Lines"> </a><a href="https://codeclimate.com/repos/6318a10510f06201be01345a/maintainability"><img src="https://api.codeclimate.com/v1/badges/54ee3c20614d0ae8314b/maintainability" /></a>

# ⛏ Leadminer

Leadminer is a tool to mine and transmute raw and passive contacts from your own communication tools (email mailbox, social networks) into actionable and qualified leads.

## Self-hosting and running Leadminer

Docker is the recommended solution for self-hosting Leadminer thanks to its convenience and ease of use. You can also run Leadminer without using Docker containers.

### Run Leadminer using docker-compose

1. Clone the repository and enter `leadminer` folder

2. Copy [.env.example](/.env.example) to `.env` and edit it depending on your environment.

3. Start docker-compose

```
 docker-compose up --build --force-recreate
```

4. Navigate to `localhost:8080`.

### Run Leadminer locally

1. Install and configure the following dependencies:

   - Node JS (version 14 or higher)
   - [Postgres](https://www.postgresql.org/docs/current/tutorial-start.html)
   - Redis

2. Clone the repository and install the required node modules.

```sh
# Clone the repository
git clone https://github.com/ankaboot-source/leadminer
cd leadminer

# Install the required node modules.
npm i --prefix ./backend && npm i --prefix ./frontend
```

3.  Set the required environment variables:

    - **Frontend (Quasar SPA)** :

      - Google Client Id : `GG_CLIENT_ID` (**Required if using Google API**)
      - Supabase Project Url : `SUPABASE_PROJECT_URL` (**Required**)
      - Supabase Project Token : `SUPABASE_SECRET_PROJECT_TOKEN` (**Required**)
      - Leadminer API Server Host : `SERVER_ENDPOINT` (**Required**)

      **You can configure these variables by copying `/frontend/.env.example` to `frontend/.env` and adding the missing values.**

    - **Backend (Express JS Server)** :

      - There are several environment variables that need to be set.A template of the configuration file is provided in `/backend/config/example.yml`.

      - To configure the application, reference **example.yml** `/backend/config/example.yaml` and create your own config file. Depending on your environment, you should name it **production.yml** if you are in production, else **default.yml**.

      - _When working in production environment, don't forget to set `NODE_ENV` to `production`_.

4.  Start the API Server and the Frontend

```sh
 npm start --prefix ./backend & npm start --prefix ./frontend
```

### Run Leadminer in development mode

You can easily get started with development mode by following theses steps:

1. Install the required dependencies

```sh
npm run install-deps
```

2. Copy `/backend/config/development.example.yml` and `/frontend/.env.example` to `/backend/config/development.yml` and `/frontend/.env` respectively, then add the missing configurations (Google client Id and secret -- You can set the `SUPABASE_SECRET_PROJECT_TOKEN` after starting supabase services).

3. Start your environment by running the following commands:

```sh
# Start supabase services
npm run dev:supabase
# Make sure to update SUPABASE_SECRET_PROJECT_TOKEN using the provided anon_key in both frontend and backend

# Start required services (Redis) -- You can skip this step if you want to use your local instances
docker-compose -f docker-compose.dev.yml up

# Start the backend in development mode
npm run dev:backend

# Start the frontend in development mode
npm run dev:frontend
```

- When altering the database schema or creating new tables, functions..., make sure to run these commands (While supabase services are up):

```sh
# List the changes that you made
npx supabase db diff --use-migra

# Create a migration for the changes that you have made
npx supabase db diff --use-migra -f <name_of_migration>

# Stop supabase services once you're done
npx supabase stop
```

## Support

If you have any trouble, check the [issues tab](https://github.com/ankaboot-source/leadminer/issues). We might already have reported/fixed the problem. Make sure you're on the latest version. If your problem persists, feel free to open a new issue.

This app is provided for free as such with no guarantee nor support. For any kind of support, feel free to reach [ankaboot professional services](contact@ankaboot.fr).

## Roadmap

- [ ] New sources : LinkedIn, Instagram, Facebook Messenger
- [ ] Enrich data : Get more relevant and actionable informations about your contacts
- [ ] Marketing automation : send emails directly from LeadMiner with personalized templates

For any requests concerning the roadmap, you could either have a look on issues or for any specific request contact [ankaboot professional services](contact@ankaboot.fr).

## Contributing

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
