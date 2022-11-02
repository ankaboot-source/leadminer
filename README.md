<P><a href="https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml"><img src="https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml/badge.svg?branch=main" alt="Build & Deploy"></a>
<img src="https://img.shields.io/badge/Coverage-87.9%25-yellow.svg?style=flat" alt="Lines"> </a><a href="https://codeclimate.com/repos/6318a10510f06201be01345a/maintainability"><img src="https://api.codeclimate.com/v1/badges/54ee3c20614d0ae8314b/maintainability" /></a></p>

# ⛏ Leadminer

Leadminer is a tool to mine and transmute raw and passive contacts from your own communication tools (email mailbox, social networks) into actionables and qualified leads.

## Installation

### From source

Install and configure the following dependencies.

- node (version 14 or higher)
- [postgres](https://www.postgresql.org/docs/current/tutorial-start.html)
- redis

Clone the repository

```shell
 git clone https://github.com/ankaboot-source/leadminer
```

Install the required node modules.

```shell
 npm install --prefix ./leadminer/backend && npm install --prefix ./leadminer/frontend
```

### Set the required environment variables.

#### Frontend

- Google Client Id : `GG_CLIENT_ID` (**Required if using Google API**)
- Supabase Client Id : `SUPABASE_ID` (**Required**)
- Supabase Project Token : `SUPABASE_TOKEN` (**Required**)

#### Backend

- There are several environment variables that need to be set. A template of the configuration file is provided in `backend/config/example.yml`.

To configure the application (e.g database host and password), reference **example.yml** `leadminer/backend/config/example.yaml` and create your own config file, depending on your environement you should name it **production.yml** if you are in production, else **default.yml**.(Any other name the app will consider that no config file is provided, so it will throw errors.)
When working in production environment, don't forget to set `NODE_ENV` to `production`.

#### Development mode

Here you will start the project in **dev mode**

Start the backend API server and the front-end if the backend has succeed.

```shell
 npm start --prefix ./leadminer/backend & npm start --prefix ./leadminer/frontend
```

### Run leadminer using Docker Compose

Clone the repository and start docker-compose

```shell
 git clone https://github.com/ankaboot-source/leadminer
 cd leadminer
```

Copy [example.yml](/backend/config/example.yml) to `default.yml` and edit it.

```
 docker-compose up
```

open `localhost:8080` and see the result.

## Support

If you have any trouble, check the issues. We might already have fixed the problem. Make sure you're on the latest version. If your problem persists, feel free to open a new issue.

This app is provided for free as such with no guarantee nor support. For any kind of support, feel free to reach [ankaboot professional services](contact@ankaboot.fr).

## Roadmap

- [ ] New sources : LinkedIn, Instagram, Facebook Messenger
- [ ] Enrich data : Get more relevant and actionable informations about your contacts
- [ ] Marketing automation : send emails directly from LeadMiner with personalized templates

For any requests concerning the roadmap, you could either have a look on issues or for any specific request contact [ankaboot professional services](contact@ankaboot.fr).

## Contributing

Please feel free to contribute. Pull requests are welcome.

1. Fork the project (<https://github.com/ankaboot-source/leadminer>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request

For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

This software is [dual-licensed](DUAL-LICENSE.md) under [GNU AGPL v3](LICENSE).
