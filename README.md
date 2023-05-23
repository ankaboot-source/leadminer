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

### Running the Project Locally (Dev mode)

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

## Contributing

Thank you for considering contributing to this project! Pull requests are welcome and encouraged. To contribute, please follow the guidelines below:

### General Guidelines

1. Fork this [repository](https://github.com/ankaboot-source/leadminer)
2. Create a branch for your feature or bug fix (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request

For major changes or new features, it is recommended to open an issue first to discuss and get feedback from the maintainers and the community. Also make sure to update or create tests as appropriate to maintain the code quality and ensure that the project functions as expected.

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

