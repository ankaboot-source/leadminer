[![Build & Deploy](https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy-demo.yml/badge.svg)](https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy-demo.yml) [![DeepSource](https://deepsource.io/gh/ankaboot-source/leadminer.svg/?label=active+issues&show_trend=true&token=M4B7pZCjFk2wl_EJpgQ9f-le)](https://deepsource.io/gh/ankaboot-source/leadminer/?ref=repository-badge) </a>[![Maintainability](https://api.codeclimate.com/v1/badges/42e68c56bc3ce2b1f59b/maintainability)](https://codeclimate.com/repos/63f7174b3d043100a803ee03/maintainability)

# ⛏ Leadminer

Leadminer is a tool to mine and transmute raw and passive contacts from your own communication tools (email mailbox, social networks) into actionable and qualified leads.

## Self-hosting and running Leadminer

Docker is the recommended solution for self-hosting Leadminer thanks to its convenience and ease of use.

### Run using docker-compose

1. Clone the repository and enter `leadminer` folder

1. Copy [.env.example](/.env.example) to `.env` and add the missing required environment variables

   ```sh
   cp .env.example .env
   ```

3. Start docker-compose:

   ```sh
   docker-compose up --build --force-recreate
   ```

4. Navigate to `localhost:8080`.

### Running the Project Locally

To run the project in your local environment, follow the steps below:

1. Install the required dependencies by running the following command:

   ```sh
   npm run install-deps
   ```

2. Start the Supabase services and take note of the Supabase project token for the next step. Run the following command:

   ```sh
   npm run dev:supabase
   ```

3. Create the `.env` files by executing the command below.

   > This will create `.env` files in the `/frontend` and `/backend` directories. Make sure to set the missing required variables in these files.

   ```sh
   cp /frontend/.env.example /frontend/.env && cp /backend/.env.example /backend/.env
   ```

3. Start your environment by running the following commands:

   ```sh
   # Start the Redis container (You can skip this step if you want to use your local instance)
   docker-compose -f docker-compose.dev.yml up
   
   # Start the backend in development mode
   npm run dev:backend-api
   npm run dev:backend-worker
   
   # Start the frontend in development mode
   npm run dev:frontend
   ```

**Generating a new migration for schema changes:**

If you need to alter the database schema or create new tables or functions, follow these steps (while Supabase services are up):

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

### Environment variables

**LEADMINER API environment variables:**

The following environment variables are used to configure the Leadminer API

```js
LEADMINER_API_HASH_SECRET='Used to hash user emails and data in logs while mining. '
LEADMINER_MINING_ID_GENERATOR_LENGTH='The length of the generated ID for mining. The default value is 10.'
LEADMINER_API_LOG_LEVEL='One of the syslog levels defined in RFC5424 (debug, info, notice, warning...). default is "debug".'
LEADMINER_API_PORT='The port number for the LEADMINER API. The default value is 8081.'
```

**IMAP environment variables:**

The following environment variables are related to IMAP configuration:

```js
IMAP_FETCH_BODY='Enable or disable fetching Email bodies. The default value is false.'
IMAP_AUTH_TIMEOUT='Time in milliseconds to wait for authentication after establishing an IMAP connection. Default is 10000.'
IMAP_CONNECTION_TIMEOUT='Number of milliseconds to wait for a connection to be established. The default value is 10000.'
IMAP_MAX_CONNECTIONS='Maximum number of simultaneous IMAP connections allowed. It is recommended to set between 1 and 15.'

```

**SUPABASE environment variables:**

The following environment variables are used to configure Supabase

```js
SUPABASE_PROJECT_URL='The URL of your Supabase project.'
SUPABASE_SECRET_PROJECT_TOKEN:='The secret project token for your Supabase project.'
PG_CONNECTION_STRING='The Postgres connection string. Only needed when CONNECTION_TYPE is "native".'
CONNECTION_TYPE='Set to "native" to use native pgsql calls through node-postgres or "pgrest" to use the REST interface.'
```

**REDIS environment variables:**

The following environment variables are related to Redis configuration:

```js
REDIS_HOST='The Redis host. The default value is "localhost".'
REDIS_PORT='The Redis port. The default value is 6379.'
REDIS_TLS='Enable or disable Redis TLS. The default value is false.'
REDIS_EXPIRATION_TIMEOUT='Expiration timeout for Redis entries. The default value is 259200.'
REDIS_CONSUMER_BATCH_SIZE='The batch size for Redis consumers. The default value is 100.'
```

**PROVIDERS environment variables:**

The following environment variables are used to configure provider-specific settings:

```js
GOOGLE_AUTHORIZATION_URL='The authorization URL for Google.'
GOOGLE_TOKEN_URL='The token URL for Google.'
GOOGLE_ISSUER_URL='The issuer URL for Google.'
GOOGLE_USERINFO_URL= 'The userinfo URL for Google.'
GOOGLE_JWK_URI='The JWK URI for Google.'
GOOGLE_CLIENT_ID='The client ID for Google.'
GOOGLE_SECRET='The client secret for Google.'
GOOGLE_IMAP_SERVER='The IMAP server for Google.'
AZURE_AUTHORIZATION_URL='The authorization URL for Microsoft Azure.'
AZURE_TOKEN_URL='The token URL for Microsoft Azure.'
AZURE_ISSUER_URL='The issuer URL for Microsoft Azure.'
AZURE_USERINFO_URL='The userinfo URL for Microsoft Azure.'
AZURE_JWK_URI='The JWK URI for Microsoft Azure.'
AZURE_CLIENT_ID='The client ID for Microsoft Azure.'
AZURE_SECRET='The client secret for Microsoft Azure.'
MICROSOFT_IMAP_SERVER='The IMAP server for Microsoft.'
```

References

- [Google OpenID Configuration](https://accounts.google.com/.well-known/openid-configuration)
- [Google OAuth2](https://developers.google.com/identity/protocols/oauth2)
- [Google Gmail IMAP/SMTP](https://developers.google.com/gmail/imap/imap-smtp)

- [Microsoft Azure OpenID Configuration](https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration)
- [Microsoft Azure OAuth2](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [Microsoft POP, IMAP, and SMTP settings](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353)

**SENTRY environment variables:**

The following environment variables are used to configure Sentry for reporting and monitoring:

```js
SENTRY_ENABLED='Set to "true" to activate Sentry for reporting and monitoring. The default value is false.''
SENTRY_DSN='Your Sentry DSN. Make sure to provide a valid value.''
```

## Contributing

Thank you for considering contributing to this project! Pull requests are welcome and encouraged. To contribute, please follow the guidelines below:

### General Guidelines

1. Fork this [repository](https://github.com/ankaboot-source/leadminer)
2. Create a branch for your feature or bug fix (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request

For major changes or new features, it is recommended to open an issue first to discuss and get feedback from the maintainers and the community.

_Make sure to update or create tests as appropriate to maintain the code quality and ensure that the project functions as expected._

## Roadmap

- [ ] New sources : LinkedIn, Instagram, Facebook Messenger
- [ ] Enrich data : Get more relevant and actionable information about your contacts
- [ ] Marketing automation : send emails directly from Leadminer with personalized templates

For any specific requests or suggestions regarding the roadmap, please feel free to contact [ankaboot professional services](https://chat.openai.com/contact@ankaboot.fr) or check the open issues for ongoing discussions and updates. 

## Support

If you encounter any issues, please check the [issues tab](https://github.com/ankaboot-source/leadminer/issues) to see if it has already been reported and resolved. Ensure that you are using the latest version before reporting an issue. If the problem persists, feel free to open a new issue.

Please note that this app is provided for free and without any guarantee or official support. If you require additional assistance, you can contact [ankaboot professional services](https://chat.openai.com/contact@ankaboot.fr) for help.

## License

This software is [dual-licensed](DUAL-LICENSE.md) under [GNU AGPL v3](LICENSE).

