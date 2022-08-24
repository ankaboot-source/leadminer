<h1 align="center">
  <br>
  <a href="https://github.com/ankaboot-source/"><img src="/frontend/public/icons/favicon-128x128.png" alt="Ankaboot" width="200"></a>
  <br>
  Ankaboot
  <br>
  <br>
</h1>
<h4 align="center">The inbox email addresses extractor and qualifier</h4>
<p align="center">
  <a href="https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml"><img src="https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml/badge.svg?branch=main" alt="Build & Deploy"></a>
  <img src="https://img.shields.io/badge/Coverage-87.9%25-yellow.svg?style=flat" alt="Lines"></a>
</p>
<br>

# Leadminer

Leadminer is a tool to mine and transmute passive contacts from your own data sources (email mailbox, social networks) into organic and qualified leads.

## Installation

### From source
#### Prerequisites
Install and configure the following dependencies.
* node (version 14 or higher)
* [postgres]https://www.postgresql.org/docs/current/tutorial-start.html()
* redis

To check if redis is working and accessible. Issue the following command.
```shell
echo ping | redis-cli [URL|address]
```

Clone the reposotory
```shell
$ git clone https://github.com/ankaboot-source/leadminer
```
Install the required node modules.
```shell
$ npm install --prefix ./leadminer/backend
$ npm install --prefix ./leadminer/frontend
```
## Configuration
To configure the backend API to use different variables. Please check the provided in `leadminer/backend/config/example.yaml` And edit `leadminer/backend/config/default.yaml` as needed.

TODO: When the frontend endpoint bacomes dynamic, document the process of specifying the endpoint in production mode.


## Deployment
### Starting in development mode
Start the backend API server.
```shell
$ npm start --prefix ./leadminer/backend
```
In another terminal window. Start the frontend.
```shell
$ npm start --prefix ./ledminer/frontend
```
### Starting in production mode
Leadminer already have a CI/CD pipeline. You can find the deployment workflow yml file [here](/.github/workflows/Deploy.yml).

## Troubleshooting
Nodejs must be version 14 or higher.
## Support

This app is provided for free as such with no guarantee nor support. For any kind of support, feel free to reach [ankaboot professional services](contact@ankaboot.fr).

## Roadmap

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
