<P><a href="https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml"><img src="https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml/badge.svg?branch=main" alt="Build & Deploy"></a>
<img src="https://img.shields.io/badge/Coverage-87.9%25-yellow.svg?style=flat" alt="Lines"></a></p>

# ⛏ Leadminer

Leadminer is a tool to mine and transmute passive contacts from your own data sources (email mailbox, social networks) into organic and qualified leads.

## Installation
### From source
Install and configure the following dependencies.
* node (version 14 or higher)
* [postgres](https://www.postgresql.org/docs/current/tutorial-start.html)
* redis

Clone the repository
```shell
$ git clone https://github.com/ankaboot-source/leadminer
```
Install the required node modules.
```shell
$ npm install --prefix ./leadminer/backend && npm install --prefix ./leadminer/frontend
```

To configure the application (e.g database host and password), edit `leadminer/backend/config/example.yaml`. When working in production environment, set the `NODE_ENV` environment variable to `production`.

#### Deployment
Start the backend API server.
```shell
$ npm start --prefix ./leadminer/backend & npm start --prefix ./ledminer/frontend
```
### Using Docker Compose
Clone the repository and start docker-compose
```shell
$ git clone https://github.com/ankaboot-source/leadminer
$ cd leadminer
```
Edit the configuration in backend as needed and set the `DB_PASSWORD` environment variable to your database password specified in the config.
```
$ export DB_PASSWORD=mysecretpassword
$ docker-compose up
```
We have a CI/CD pipeline that does just that. Check the [deployment workflow yml file](/.github/workflows/Deploy.yml).

## Troubleshooting
If you have any trouble, check the issues. We might already have fixed the problem. Make sure you're on the latest version. If your problem persists, feel free to open a new issue.

## Support

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
